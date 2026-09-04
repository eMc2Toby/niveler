/**
 * Entrega el shell de la SPA sin caché para que las rutas visitadas (por
 * ejemplo /productos) cambien de versión al mismo tiempo que el despliegue.
 * Los assets con hash siguen la ruta rápida de Static Assets y conservan su
 * caché inmutable.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const respuesta = await env.ASSETS.fetch(request)
    const tipoContenido = respuesta.headers.get('content-type') ?? ''

    if (!tipoContenido.includes('text/html')) return respuesta

    const headers = new Headers(respuesta.headers)
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    return new Response(respuesta.body, {
      status: respuesta.status,
      statusText: respuesta.statusText,
      headers,
    })
  },
} satisfies ExportedHandler<Env>
