async function test() {
  const id = '221dcbb9-6eef-4f21-bb34-756aecac0785'; // A valid testimonial ID
  const response = await fetch(`http://localhost:3000/api/testimonials/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true })
  });
  
  console.log("Status:", response.status);
  const json = await response.json();
  console.log("Response body:", json);
}
test();
