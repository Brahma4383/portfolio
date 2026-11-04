// Everything the portfolio says about me lives in this one file.
// The 3D world, the info panels and the classic (non-3D) page all read from here,
// so updating a project or a skill only ever means editing this file.

export const profile = {
  name: 'Brahmanand Suryawanshi',
  firstName: 'Brahmanand',
  role: 'Backend Developer & Software Tester',
  // The two sides of my work. Shown together wherever my title appears.
  tracks: [
    {
      id: 'backend',
      title: 'Backend Developer',
      tools: 'Python & Django',
      stack: ['Python', 'Django', 'DRF', 'PostgreSQL', 'MySQL', 'REST APIs'],
    },
    {
      id: 'testing',
      title: 'Software Tester',
      tools: 'Java & Selenium',
      stack: ['Java', 'Selenium WebDriver', 'TestNG', 'Maven', 'Postman', 'Manual testing'],
    },
  ],
  location: 'Navi Mumbai, Maharashtra',
  summary:
    'I work on both sides of the same software. As a backend developer I build REST APIs and ERP modules with Python, ' +
    'Django, Django REST Framework and PostgreSQL. As a software tester I test web applications by hand and automate them ' +
    'with Java, Selenium WebDriver and TestNG: writing test scenarios and test cases, running functional, regression, smoke ' +
    'and sanity tests, testing APIs in Postman and checking the data with SQL. Building the code helps me test it well, ' +
    'and testing it helps me build it right.',
  boardLine: 'Backend developer with Python & Django, and software tester with Java, Selenium and TestNG.',
  boardTags: ['Python', 'Django', 'Java', 'Selenium', 'TestNG'],
  facts: [
    { label: 'Based in', value: 'Navi Mumbai, India' },
    { label: 'Working on', value: 'Building and testing ERP modules at Shubham Tanks And Liners' },
    { label: 'Languages', value: 'English, Hindi, Marathi' },
  ],
}

// The Test Lab: how I test, step by step (the six stages of the STLC).
export const testing = {
  intro: 'Every feature goes through the same loop before it ships.',
  steps: [
    { name: 'Requirements', text: 'Read the spec and list everything that could break.' },
    { name: 'Test plan', text: 'Decide scope, types of testing, browsers and environments.' },
    { name: 'Test cases', text: 'Write scenarios and cases with boundary values and equivalence classes.' },
    { name: 'Environment', text: 'Set up builds, browsers and test data.' },
    { name: 'Execution', text: 'Run manual checks, Selenium + TestNG suites, and Postman for the APIs.' },
    { name: 'Closure', text: 'Log defects in Jira, retest the fixes, run regression and report.' },
  ],
  toolkit: [
    'Selenium WebDriver', 'TestNG', 'Page Object Model', 'Page Factory', 'Maven', 'Apache POI',
    'Playwright', 'Postman', 'SQL', 'Jira', 'Jenkins (basics)', 'Chrome DevTools',
  ],
}

// How I build, step by step. The classic page shows it beside the testing loop above.
export const development = {
  intro: 'Every feature I build follows the same path.',
  steps: [
    { name: 'Requirements', text: 'Understand the business flow and the rules behind it.' },
    { name: 'Design', text: 'Model the tables and relations, and plan the REST endpoints.' },
    { name: 'Build', text: 'Write Django models, views and DRF serializers with validation and permissions.' },
    { name: 'Database', text: 'Write migrations and tune SQL queries on PostgreSQL and MySQL.' },
    { name: 'Self-check', text: 'Call my own endpoints in Postman and debug them before handing over.' },
    { name: 'Release', text: 'Push with Git, fix what testing finds and ship it in the sprint.' },
  ],
  toolkit: [
    'Python', 'Django', 'Django REST Framework', 'REST APIs', 'PostgreSQL', 'MySQL',
    'SQL', 'Git & GitHub', 'Postman', 'Agile / Scrum',
  ],
}

export const experience = [
  {
    role: 'Backend Developer (Development & Testing)',
    company: 'Shubham Tanks And Liners Pvt Ltd',
    place: 'Thane, Maharashtra',
    period: 'Feb 2026 – Present',
    points: [
      'Development: build and maintain ERP modules and REST APIs with Python, Django, DRF and PostgreSQL in Agile sprints.',
      'Design and optimise backend logic and database queries for performance, scalability and security.',
      'Manual testing: write and run functional, regression and smoke test cases for each module before release.',
      'Automation: automate regression checks for key ERP workflows with Selenium WebDriver, Java and TestNG.',
      'API & database testing: test the ERP APIs in Postman and verify saved data with SQL queries.',
      'Defect handling: reproduce production issues, log defects with steps and screenshots, then fix and retest them.',
    ],
    stack: ['Python', 'Django', 'DRF', 'PostgreSQL', 'Selenium WebDriver', 'Java', 'TestNG', 'Postman'],
  },
]

const GITHUB = 'https://github.com/Brahma4383'

// Every project is told in two steps: first how I built it, then how I tested it.
export const projects = [
  {
    name: 'School Management System',
    kind: 'Role-based school portal',
    built: {
      text:
        'A full-stack portal for admins, teachers and students: attendance (with bulk CSV upload), assignments, exam results ' +
        'and performance tracking. Built with Python and Django, raw SQL queries on MySQL, and Django templates with HTML, CSS and JavaScript.',
      stack: ['Python', 'Django', 'MySQL', 'Raw SQL', 'JavaScript'],
    },
    tested: {
      text:
        'Built a hybrid Selenium automation framework for it with Java, TestNG and Maven using the Page Object Model, covering ' +
        'login, attendance and assignments. Data-driven tests (TestNG DataProvider with Excel data via Apache POI) check role-based ' +
        'access for every user type; listeners capture screenshots on failure and produce HTML reports, and the smoke and regression ' +
        'suites run from testng.xml on Chrome, Firefox and Edge.',
      stack: ['Selenium', 'Java', 'TestNG', 'Maven', 'Apache POI'],
    },
    link: GITHUB,
  },
  {
    name: 'Ticket Booking Platform',
    kind: 'Multi-service bookings',
    built: {
      text:
        'One user account for train, bus, cab, hotel and flight bookings, with booking data kept in one consistent format ' +
        'across every service. Built with Python, Django and MySQL, with a TypeScript front end.',
      stack: ['Python', 'Django', 'MySQL', 'TypeScript'],
    },
    tested: {
      text:
        'Tested the end-to-end search, booking and cancellation flows for all five services. Automated the key flows with ' +
        'Selenium and Java (dropdowns, date pickers, multiple windows and alerts) and tested the booking APIs in Postman ' +
        'for status codes, response data and negative cases.',
      stack: ['Selenium', 'Java', 'Postman', 'E2E'],
    },
    link: GITHUB,
  },
  {
    name: 'DayFlow',
    kind: 'Personal productivity app',
    built: {
      text:
        'One dashboard for the whole day: tasks, habits, notes and a focus timer, with progress reports. ' +
        'A Django REST Framework API on MySQL with a React front end, set up for deployment on Vercel.',
      stack: ['Python', 'Django', 'DRF', 'MySQL', 'React'],
    },
    tested: {
      text:
        'Wrote a Postman collection of 72 API requests with 148 automated checks across auth, tasks, habits, focus sessions ' +
        'and the dashboard, including negative cases such as duplicate emails, weak passwords, missing tokens, invalid filters ' +
        'and completing a habit twice.',
      stack: ['Postman', 'API testing', 'Negative testing'],
    },
    link: GITHUB,
  },
  {
    name: 'Banking Management System',
    kind: 'Accounts & transactions',
    built: {
      text:
        'Account creation, deposits, withdrawals and fund transfers between accounts, with security checks around every ' +
        'transaction so account data stays safe and balances stay accurate. Built with Python, Django and SQL.',
      stack: ['Python', 'Django', 'SQL'],
    },
    tested: {
      text:
        'Wrote test scenarios and test cases for every transaction type using boundary value analysis and equivalence ' +
        'partitioning (zero, negative and over-balance amounts). Ran functional, negative and regression tests, checked ' +
        'balances in the database with SQL, and logged defects with severity and priority.',
      stack: ['Manual testing', 'BVA / EP', 'SQL'],
    },
    link: GITHUB,
  },
]

// Each group becomes one stack of crates in the Skills area (six crates per stack).
// `more` only appears in the info panel and the classic page.
export const skillGroups = [
  {
    name: 'Backend Development',
    color: '#e0912b',
    crates: ['Python', 'Django', 'DRF', 'REST APIs', 'PostgreSQL', 'MySQL'],
    more: ['SQL', 'Core Java (OOP, Collections)', 'React', 'JavaScript', 'Git & GitHub', 'Jenkins (basics)', 'Chrome DevTools', 'Agile / Scrum'],
  },
  {
    name: 'Automation Testing',
    color: '#3f9b5a',
    crates: ['Selenium', 'Java', 'TestNG', 'POM', 'Maven', 'Playwright'],
    more: ['Page Factory', 'DataProvider', 'TestNG listeners', 'Apache POI', 'XPath & CSS locators', 'Explicit waits', 'Actions & JS Executor', 'Cross-browser runs'],
  },
  {
    name: 'Manual & API Testing',
    color: '#2b8fbd',
    crates: ['Manual Testing', 'Postman', 'SQL', 'Jira', 'STLC', 'Regression'],
    more: ['Functional', 'Smoke & sanity', 'Integration & system', 'UI & cross-browser', 'Boundary value analysis', 'Equivalence partitioning', 'Defect life cycle', 'SDLC'],
  },
]

export const education = [
  {
    title: 'B.E. in Computer Science & Design',
    place: 'University of Mumbai',
    period: '2022 – 2025',
  },
  {
    title: 'Diploma in Information Technology',
    place: 'MSBTE',
    period: '2019 – 2022',
  },
]

export const certifications = [
  { title: 'Data Analytics', place: 'QSpiders', period: 'Jul – Nov 2025' },
  { title: 'Python Programming & SQL', place: 'Anudip Foundation', period: 'Jan 2025' },
]

// The resume can be opened in the browser (view) or saved (download).
export const resume = {
  file: 'resume/Brahmanand_Suryawanshi_Resume.pdf',
  fileName: 'Brahmanand_Suryawanshi_Resume.pdf',
}

export const contacts = [
  {
    id: 'github',
    label: 'GitHub',
    value: 'github.com/Brahma4383',
    href: 'https://github.com/Brahma4383',
    color: '#24292f',
    action: 'Open GitHub',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    value: 'linkedin.com/in/brahma-s4383',
    href: 'https://www.linkedin.com/in/brahma-s4383',
    color: '#0a66c2',
    action: 'Open LinkedIn',
  },
  {
    id: 'email',
    label: 'Email',
    value: 'brahma9021@gmail.com',
    href: 'mailto:brahma9021@gmail.com',
    color: '#d9483b',
    action: 'Write an email',
  },
  {
    id: 'resume',
    label: 'Resume',
    value: 'View or download (PDF)',
    href: resume.file,
    color: '#2a9d8f',
    action: 'View resume',
  },
]

export const phone = { label: '+91 90210 24383', href: 'tel:+919021024383' }
