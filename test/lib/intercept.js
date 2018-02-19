let Http = require('http')

const requestsToIntercept = {
  "api.spm-style.com": {
    "/user": {
      // REGISTER
      PUT: {
        token: 'testToken',
        user: {
          login: 'testTravis',
          email: 'test@travis.com'
        }
      },
      // LOGIN
      POST: {
        token: 'testToken',
        user: {
          login: 'testTravis',
          email: 'test@travis.com'
        }
      }
    }
  }
}

let startInterceptor = () => {
  let Mitm = require('mitm')()
  Mitm.on('request', (req, res) => {
    let msg = requestsToIntercept[req.headers.host] && requestsToIntercept[req.headers.host][req.url] && requestsToIntercept[req.headers.host][req.url][req.method]
    ? requestsToIntercept[req.headers.host][req.url][req.method] : { msg: 'KO', statusCode: 402 }
    res.end(JSON.stringify(msg))
  })
  return Mitm
}

let stopInterceptor = (Mitm) => {
  Mitm.disable()
}

module.exports = {
  startInterceptor,
  stopInterceptor
}
