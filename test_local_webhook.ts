async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/webhook/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'local' })
    });
    console.log(res.status);
  } catch (e) {
    console.error(e.message);
  }
}
test();
