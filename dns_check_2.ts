import dns from 'dns';

dns.resolve('link-inmobiliario-evolution-api.hfsosq.easypanel.host', (err, addresses) => {
  console.log('original:', err ? err.message : addresses);
});

dns.resolve('evolution-api.hfsosq.easypanel.host', (err, addresses) => {
  console.log('shorter:', err ? err.message : addresses);
});

dns.resolve('hfsosq.easypanel.host', (err, addresses) => {
  console.log('base:', err ? err.message : addresses);
});
