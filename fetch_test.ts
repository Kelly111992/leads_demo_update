async function test() {
  try {
    const res = await fetch('https://link-inmobiliario-evolution-api.hfsosq.easypanel.host');
    console.log(res.status);
  } catch (e) {
    console.error(e.message);
  }
}
test();
