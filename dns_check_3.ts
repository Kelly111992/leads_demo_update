import dns from 'dns';

dns.resolveAny('link-inmobiliario-evolution-api.hfsosq.easypanel.host', (err, addresses) => {
  console.log('original:', err ? err.message : addresses);
});
