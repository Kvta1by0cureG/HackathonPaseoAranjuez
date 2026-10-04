import cors from 'cors';
import express from 'express';
import { crearAutenticarAdmin } from './middlewares/adminAuth.js';
import { crearAutenticarWebApp } from './middlewares/auth.js';
import { crearManejadorDeErrores, rutaNoEncontrada } from './middlewares/errors.js';
import { limitarPeticiones } from './middlewares/rateLimit.js';
import { cabecerasDeSeguridad } from './middlewares/securityHeaders.js';
import { crearValidarFirmaWebhook, crearVerificarWebhook } from './middlewares/validateWebhook.js';
import { crearAdminRouter } from './routes/admin.js';
import { crearApiRouter } from './routes/api.js';
import { crearDevRouter } from './routes/dev.js';
import { crearNotificacionesRouter } from './routes/notifications.js';
import { crearWebhookRouter } from './routes/webhook.js';

const LIMITE_CUERPO = '100kb';

/**
 * Construye la aplicación Express a partir de la configuración y los servicios
 * ya creados (ver container.js). No abre puertos ni conecta a la base de datos,
 * por eso se puede montar en los tests con servicios falsos.
 */
export function crearApp({ config, servicios, log = console }) {
  const { usuarios, sesiones, catalogo, score, mensajeria, procesador } = servicios;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(cabecerasDeSeguridad({ esProduccion: config.esProduccion }));

  // Se conserva el cuerpo crudo: la firma del webhook se calcula sobre él.
  app.use(express.json({
    limit: LIMITE_CUERPO,
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // El webhook lo llama Meta de servidor a servidor: no necesita CORS ni límite
  // por IP (lo protege la firma y el tope de mensajes por usuario).
  app.use('/webhook', crearWebhookRouter({
    verificar: crearVerificarWebhook({ verifyToken: config.whatsapp.verifyToken }),
    validarFirma: crearValidarFirmaWebhook({ appSecret: config.whatsapp.appSecret, log }),
    procesador,
    log
  }));

  const corsApi = cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    maxAge: 600
  });
  const limitarApi = limitarPeticiones({ limite: config.limites.apiPorMinuto });
  const autenticarAdmin = crearAutenticarAdmin({ apiKey: config.admin.apiKey });

  app.use('/api', corsApi, limitarApi);
  app.use('/api/notifications', autenticarAdmin, crearNotificacionesRouter({ mensajeria, log }));
  app.use('/api/admin', autenticarAdmin, crearAdminRouter({ score }));
  app.use('/api', crearApiRouter({
    sesiones,
    usuarios,
    catalogo,
    autenticar: crearAutenticarWebApp({ sesiones }),
    limitarCanje: limitarPeticiones({
      limite: config.limites.canjesPorMinuto,
      mensaje: 'Demasiados intentos de abrir el panel, espera un minuto'
    })
  }));

  // Rutas de desarrollo: solo con WhatsApp simulado y nunca en producción.
  if (config.whatsapp.mock && !config.esProduccion) {
    app.use('/dev', limitarApi, crearDevRouter({ usuarios, sesiones, procesador, mensajeria }));
    log.warn('⚠️ Rutas /dev habilitadas (WHATSAPP_MOCK=true). No usar en producción.');
  }

  app.get('/', (req, res) => {
    res.json({ ok: true, message: 'WhatsApp Agent Backend' });
  });

  app.use(rutaNoEncontrada);
  app.use(crearManejadorDeErrores({ log }));

  return app;
}
