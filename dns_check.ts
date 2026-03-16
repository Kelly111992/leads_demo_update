import dns from 'dns';

dns.resolve('evolutionapi-evolution-api.ckoomq.easypanel.host', (err, addresses) => {
  console.log('original:', err ? err.message : addresses);
});

dns.resolve('evolution-api.ckoomq.easypanel.host', (err, addresses) => {
  console.log('shorter:', err ? err.message : addresses);
});

dns.resolve('ckoomq.easypanel.host', (err, addresses) => {
  console.log('base:', err ? err.message : addresses);
});
