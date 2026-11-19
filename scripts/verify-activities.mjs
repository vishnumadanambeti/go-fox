async function run() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@gofox.dev', password: 'gofox1234' }),
  })
  const cookie = loginRes.headers.get('set-cookie').split(';')[0]
  const listRes = await fetch('http://localhost:3001/api/resources/companies?limit=1', {
    headers: { Cookie: cookie },
  })
  const listData = await listRes.json()
  const company = listData.data[0]
  console.log('Found Company:', company.id, company.name)

  const postRes = await fetch('http://localhost:3001/api/resources/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      entity_type: 'company',
      entity_id: company.id,
      activity_type: 'note',
      title: 'QA Activity Note',
      description: 'Introductory executive briefing completed.',
    }),
  })
  console.log('Post Status:', postRes.status)

  const getRes = await fetch(`http://localhost:3001/api/resources/companies/${company.id}`, {
    headers: { Cookie: cookie },
  })
  const data = await getRes.json()
  console.log('Get Company Name:', data.record?.name)
  console.log('Activities count:', data.activity?.length)
  console.log('Latest Activity:', data.activity?.[0]?.summary)
}
run()
