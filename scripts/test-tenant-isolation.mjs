// Automated Tenant Isolation and Data Integrity Verification Test
const BASE_URL = 'http://localhost:3001'

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, headers: res.headers, data }
}

function getCookie(headers) {
  const setCookie = headers.get('set-cookie')
  if (!setCookie) return ''
  return setCookie.split(';')[0]
}

async function run() {
  console.log('--- STARTING TENANT ISOLATION & DATA INTEGRITY VERIFICATION ---')
  const results = []

  const recordResult = (name, passed, detail) => {
    results.push({ name, passed, detail })
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${detail ? `(${detail})` : ''}`)
  }

  // 1. Authenticate Tenant A (owner@gofox.dev)
  const loginA = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'owner@gofox.dev', password: 'gofox1234' }),
  })
  const cookieA = getCookie(loginA.headers)
  recordResult('Tenant A Login', loginA.status === 200, `Org: ${loginA.data?.user?.org_id}`)

  // 2. Register / Authenticate Tenant B (separate workspace)
  const randomSuffix = Math.floor(Math.random() * 10000)
  const regEmailB = `tenant_b_${randomSuffix}@isolation-test.com`
  const regB = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Tenant B Admin',
      email: regEmailB,
      company: `Tenant B Workspace ${randomSuffix}`,
      password: 'password1234',
    }),
  })
  const cookieB = getCookie(regB.headers)
  recordResult('Tenant B Registration', regB.status === 200, `Org: ${regB.data?.user?.org_id}`)

  // Verify org IDs are distinct
  const orgA = loginA.data?.user?.org_id
  const orgB = regB.data?.user?.org_id
  recordResult('Tenant Org Separation', orgA !== orgB, `OrgA=${orgA}, OrgB=${orgB}`)

  // 3. Tenant B creates records
  const authBHeaders = { Cookie: cookieB }
  const createCompanyB = await request('/api/resources/companies', {
    method: 'POST',
    headers: authBHeaders,
    body: JSON.stringify({ name: `Tenant B Private Corp ${randomSuffix}`, domain: 'tenant-b.com', industry: 'Robotics' }),
  })
  const companyBId = createCompanyB.data?.record?.id
  recordResult('Tenant B Company Creation', createCompanyB.status === 201 || createCompanyB.status === 200, `ID: ${companyBId}`)

  const createLeadB = await request('/api/resources/leads', {
    method: 'POST',
    headers: authBHeaders,
    body: JSON.stringify({ first_name: 'Confidential', last_name: 'Lead B', email: 'secret@tenant-b.com', value: 99000 }),
  })
  const leadBId = createLeadB.data?.record?.id
  recordResult('Tenant B Lead Creation', createLeadB.status === 201 || createLeadB.status === 200, `ID: ${leadBId}`)

  const createContactB = await request('/api/resources/contacts', {
    method: 'POST',
    headers: authBHeaders,
    body: JSON.stringify({ first_name: 'Confidential', last_name: 'Contact B', email: 'contact@tenant-b.com' }),
  })
  const contactBId = createContactB.data?.record?.id
  recordResult('Tenant B Contact Creation', createContactB.status === 201 || createContactB.status === 200, `ID: ${contactBId}`)

  const createListB = await request('/api/resources/lists', {
    method: 'POST',
    headers: authBHeaders,
    body: JSON.stringify({ name: 'Tenant B Secret Audience', type: 'static', category: 'Confidential' }),
  })
  const listBId = createListB.data?.record?.id
  recordResult('Tenant B List Creation', createListB.status === 201 || createListB.status === 200, `ID: ${listBId}`)

  // 4. Verification as Tenant A: Ensure Zero Leakage
  const authAHeaders = { Cookie: cookieA }

  // A. Company List & Detail Isolation
  const listCompaniesA = await request('/api/resources/companies?limit=100', { headers: authAHeaders })
  const hasCompanyBInListA = (listCompaniesA.data?.data || []).some((c) => c.id === companyBId || c.name?.includes('Tenant B Private Corp'))
  recordResult('Tenant A Company List Query Isolation', !hasCompanyBInListA, 'Tenant B company absent from Tenant A list')

  const getCompanyBAsA = await request(`/api/resources/companies/${companyBId}`, { headers: authAHeaders })
  recordResult('Tenant A Direct Company Lookup Isolation', getCompanyBAsA.status === 404, 'Returns 404 NOT_FOUND')

  // B. Lead List & Detail Isolation
  const listLeadsA = await request('/api/resources/leads?limit=100', { headers: authAHeaders })
  const hasLeadBInListA = (listLeadsA.data?.data || []).some((l) => l.id === leadBId)
  recordResult('Tenant A Lead List Query Isolation', !hasLeadBInListA, 'Tenant B lead absent from Tenant A list')

  const getLeadBAsA = await request(`/api/resources/leads/${leadBId}`, { headers: authAHeaders })
  recordResult('Tenant A Direct Lead Lookup Isolation', getLeadBAsA.status === 404, 'Returns 404 NOT_FOUND')

  // C. Contact List & Detail Isolation
  const listContactsA = await request('/api/resources/contacts?limit=100', { headers: authAHeaders })
  const hasContactBInListA = (listContactsA.data?.data || []).some((c) => c.id === contactBId)
  recordResult('Tenant A Contact List Query Isolation', !hasContactBInListA, 'Tenant B contact absent from Tenant A list')

  const getContactBAsA = await request(`/api/resources/contacts/${contactBId}`, { headers: authAHeaders })
  recordResult('Tenant A Direct Contact Lookup Isolation', getContactBAsA.status === 404, 'Returns 404 NOT_FOUND')

  // D. List & Membership Isolation
  const getListBAsA = await request(`/api/resources/lists/${listBId}`, { headers: authAHeaders })
  recordResult('Tenant A Direct List Lookup Isolation', getListBAsA.status === 404, 'Returns 404 NOT_FOUND')

  const getMembersBAsA = await request(`/api/lists/${listBId}/members`, { headers: authAHeaders })
  recordResult('Tenant A List Members Lookup Isolation', getMembersBAsA.status === 404, 'Returns 404 NOT_FOUND')

  // E. Cross-Tenant Bulk Mutation Guard
  const bulkDeleteAsA = await request('/api/resources/companies/bulk', {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({ action: 'delete', ids: [companyBId] }),
  })
  // Verify Tenant B's record was NOT deleted
  const verifyCompanyBStillExists = await request(`/api/resources/companies/${companyBId}`, { headers: authBHeaders })
  recordResult('Cross-Tenant Bulk Mutation Guard', verifyCompanyBStillExists.status === 200, 'Tenant B company intact after Tenant A bulk attempt')

  // F. Cross-Tenant Lead Mutation Guards
  const stageLeadBAsA = await request(`/api/leads/${leadBId}/stage`, {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({ stage: 'won' }),
  })
  recordResult('Cross-Tenant Stage Transition Guard', stageLeadBAsA.status === 404, 'Returns 404 NOT_FOUND')

  const aiScoreLeadBAsA = await request(`/api/leads/${leadBId}/ai-score`, {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({}),
  })
  recordResult('Cross-Tenant AI Scoring Guard', aiScoreLeadBAsA.status === 404, 'Returns 404 NOT_FOUND')

  const convertLeadBAsA = await request(`/api/leads/${leadBId}/convert`, {
    method: 'POST',
    headers: authAHeaders,
    body: JSON.stringify({ create_deal: true }),
  })
  recordResult('Cross-Tenant Lead Conversion Guard', convertLeadBAsA.status === 404, 'Returns 404 NOT_FOUND')

  const failedCount = results.filter((r) => !r.passed).length
  const passedCount = results.filter((r) => r.passed).length
  console.log(`\n--- SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ---`)
  if (failedCount > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Fatal error during test run:', err)
  process.exit(1)
})
