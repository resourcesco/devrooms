const httpProxy = require('http-proxy')
const proxyPort = process.env.PROXY_PORT
const targetPort = process.env.PORT
const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${targetPort}`,
})

proxy.on('proxyRes', function(proxyRes, req, res) {
  if (req.headers.origin === `http://localhost:${targetPort}`) {
    proxyRes.headers[
      'access-control-allow-origin'
    ] = `http://localhost:${targetPort}`
    proxyRes.headers['access-control-allow-methods'] =
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    proxyRes.headers['access-control-allow-headers'] = 'Content-Type'
  }
})

proxy.listen(proxyPort, () => {
  console.debug(`Proxying port ${proxyPort} to ${targetPort}...`)
})
