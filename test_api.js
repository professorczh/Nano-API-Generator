const fetch = require('node-fetch');
(async () => {
  try {
    console.log('Sending request...');
    const response = await fetch('http://localhost:9000/api/project/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin',
        'x-project-id': 'default'
      },
      body: JSON.stringify({ nodes: [], version: '2.0.0' })
    });
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
})();
