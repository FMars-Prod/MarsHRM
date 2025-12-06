
export const attendanceData = [
  { id: '1', employee: 'John Doe', date: '2024-07-29', clockIn: '09:01 AM', clockOut: '05:03 PM', status: 'Present' },
  { id: '2', employee: 'Jane Smith', date: '2024-07-29', clockIn: '08:55 AM', clockOut: '05:00 PM', status: 'Present' },
  { id: '3', employee: 'Peter Jones', date: '2024-07-29', clockIn: '09:15 AM', clockOut: '04:50 PM', status: 'Late' },
  { id: '4', employee: 'Mary Johnson', date: '2024-07-29', clockIn: '-', clockOut: '-', status: 'Absent' },
];

export const leaveData = [
  { id: '1', employee: 'Peter Jones', startDate: '2024-08-05', endDate: '2024-08-07', type: 'Sick Leave', status: 'Approved' },
  { id: '2', employee: 'Jane Smith', startDate: '2024-09-01', endDate: '2024-09-10', type: 'Vacation', status: 'Pending HR Approval' },
  { id: '3', employee: 'John Doe', startDate: '2024-07-30', endDate: '2024-07-30', type: 'Personal', status: 'Pending' },
];

export const issueData = [
  { id: '1', submittedBy: 'John Doe', title: 'Office AC not working', status: 'Open' },
  { id: '2', submittedBy: 'Jane Smith', title: 'Printer needs paper', status: 'In Progress' },
  { id: '3', submittedBy: 'Peter Jones', title: 'Broken chair in meeting room', status: 'Resolved' },
];

export const policyData = [
  { id: '1', title: 'Employee Handbook', version: 'v3.2', status: 'Acknowledged' },
  { id: '2', title: 'IT Security Policy', version: 'v1.8', status: 'Acknowledged' },
  { id: '3', title: 'Work From Home Policy', version: 'v2.1', status: 'Pending Acknowledgment' },
];

export const auditLogData = [
    { id: '1', user: 'CEO/Admin', action: 'Edited attendance for John Doe', timestamp: '2024-07-28 10:00 AM', details: 'Reason: Forgot to clock out.' },
    { id: '2', user: 'HR Manager', action: 'Approved leave for Peter Jones', timestamp: '2024-07-27 02:30 PM', details: 'Sick leave request from 2024-08-05 to 2024-08-07.' },
    { id: '3', user: 'Jane Smith', action: 'Submitted leave request', timestamp: '2024-07-26 09:15 AM', details: 'Vacation from 2024-09-01 to 2024-09-10.' },
    { id: '4', user: 'CEO/Admin', action: 'Granted HR Manager role to Sarah Lee', timestamp: '2024-07-25 04:00 PM', details: 'Promotion.' },
];

export const announcements = [
    { id: '1', title: "Company Picnic Announcement!", date: "2024-08-15", content: "Join us for our annual company picnic at Central Park. Fun, food, and games for everyone!" },
    { id: '2', title: "New Holiday: Founder's Day", date: "2024-08-01", content: "Please note that the office will be closed on September 5th to celebrate Founder's Day." },
    { id: '3', title: "Q3 Performance Reviews", date: "2024-07-25", content: "Performance reviews for the third quarter are starting next week. Please schedule a meeting with your team lead." },
];

export const events = [
    { id: '1', name: "Alice Johnson", event: "Birthday", date: "August 5th" },
    { id: '2', name: "Bob Williams", event: "Work Anniversary (3 years)", date: "August 12th" },
    { id: '3', name: "Charlie Brown", event: "Birthday", date: "August 21st" },
];

export const teamData = [
  { id: '1', name: 'John Doe', jobTitle: 'Software Engineer', reports: [{id: 'r1', date: '2024-07-29', summary: 'Worked on feature X.'}, {id: 'r2', date: '2024-07-28', summary: 'Fixed bug Y.'}] },
  { id: '2', name: 'Peter Jones', jobTitle: 'Frontend Developer', reports: [{id: 'r3', date: '2024-07-29', summary: 'Developed component Z.'}] },
  { id: '3', name: 'Emily White', jobTitle: 'UI/UX Designer', reports: [] },
]

    