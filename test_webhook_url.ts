async function test() {
  try {
    const res = await fetch('https://ais-pre-2xtjywkq6xgncjind7ujf7-85412012081.us-east1.run.app/api/webhook/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
