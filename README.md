# proxygen

> Generate a local development proxy in minutes.

This tool will allow you to easily create a proxy to connect various services you might be using during development, while allowing you to use a secure connection / SSL in your browser.

## Installation

```
npm install -g proxygen
```

## Usage

Launch proxygen:
```bash
proxygen proxygen.json
```

## Configuration

Create a proxy configuration file named `proxygen.json`.

For each proxy, you can configure a priority, conditions and action:
```json
{
  "domains": ["www.sample.dev"],
  "proxies": [{
    "priority": 1,
    "conditions": [{ "target": "host", "type": "equals", "value": "www.sample.dev", "then": "pass" }],
    "action": { "type": "proxy", "host": "www.sample.com" }
  }]
}
```

Make sure to create hosts file entries for the domains you have specified:
```
127.0.0.1 www.sample.dev
```

## SSL Certificates

proxygen will automatically create SSL certificates for the domains specified. When you start proxygen the first time, a CA certificate will be installed in `~/.proxygen/proxygen.ca.cert.pem`. Make sure to 'trust' this certificate in your keychain settings.

## Use Cases

You might have a setup similar to this:

* **Website** running on http://localhost:8080/
* **API Server** running on http://localhost:9000/
* **GraphQL Server** running on http://localhost:9001/graphql/
* **Cloud Storage** running in production on https://cdn.awesome.com/

Using proxygen, you can easily set up the following routing:

* https://www.awesome.dev/* serves from **Website**
* https://www.awesome.dev/api/* serves from **API Server**
* https://www.awesome.dev/graphql/* serves from **GraphQL Server**
* https://www.awesome.dev/cdn/* serves from **Cloud Storage** while caching responses locally.

Example Configuration:

```json
{
  "domains": ["www.awesome.dev"],
  "proxies": [{
    // API Server
    "priority": 1,
    "conditions": [{ "target": "path", "type": "matches", "value": "^/api/", "then": "pass" }],
    "action": { "type": "proxy", "host": "127.0.0.1", "port": 9000 }
  }, {
    // GraphQL Server
    "priority": 2,
    "conditions": [{ "target": "path", "type": "matches", "value": "^/graphql/", "then": "pass" }],
    "action": { "type": "proxy", "host": "127.0.0.1", "port": 9001 }
  }, {
    // Cloud Storage
    "priority": 3,
    "conditions": [{ "target": "path", "type": "matches", "value": "^/cdn/", "then": "pass" }],
    "action": { "type": "cache", "protocol": "https:", "host": "cdn.awesome.com", "root": "/tmp/cdn" }
  }, {
    // Website
    "priority": 4,
    "action": { "type": "proxy", "host": "127.0.0.1", "port": "8080" }
  }]
}
```

## Run as Service

Install forever:
```
npm install -g forever
```

Start service:
```
forever start (which proxygen)
```

## License

MIT
