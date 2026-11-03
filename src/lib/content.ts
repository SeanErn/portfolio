/**
 * Everything the page says about Sean, straight from the resume (Oct 2026) plus Speechify.
 * Chapters read their facts from here; chapter-specific microcopy lives in the chapter itself.
 */

export const person = {
	name: 'Sean Ernstes',
	headline: 'Computer Engineering student & open-source maintainer',
	location: 'Kalamazoo, MI / Atlanta, GA',
	email: 'seanern@gatech.edu',
	github: 'https://github.com/SeanErn',
	linkedin: 'https://www.linkedin.com/in/seanernstes',
	seeking: 'SoC, chip and PCB design co-ops starting fall 2027'
};

/** Reference designators double as chapter ids and nav labels, silkscreen-style. */
export const chapters = [
	{ id: 'speechify', ref: 'U1', label: 'Speechify' },
	{ id: 'questnav', ref: 'U2', label: 'QuestNav' },
	{ id: 'frc', ref: 'U3', label: 'FRC 5152' },
	{ id: 'cfa', ref: 'Y4', label: 'Chick-fil-A' },
	{ id: 'otsego', ref: 'J5', label: 'Otsego IT' },
	{ id: 'gatech', ref: 'U6', label: 'Georgia Tech' },
	{ id: 'skills', ref: 'U7', label: 'Skills' },
	{ id: 'bom', ref: 'BOM', label: 'Leadership' },
	{ id: 'contact', ref: 'J8', label: 'Contact' }
] as const;

export type ChapterId = (typeof chapters)[number]['id'];

export const speechify = {
	org: 'Speechify',
	role: 'Software Engineer',
	when: 'Now',
	where: 'Remote',
	// Sean is new here; the first project is likely CI/CD. Don't claim more than that.
	notes: ['Software engineer on the team behind the text-to-speech app.', 'First project: most likely CI/CD.']
};

export const questnav = {
	org: 'QuestNav',
	role: 'Lead Maintainer',
	when: 'Feb 2025 – now',
	where: 'Remote',
	notes: [
		'Architected the cross-platform VSLAM pipeline (Unity/C#, Java, Vue) for robot localization on Meta Quest 3.',
		'Grew it to 140+ stars, 80+ forks and 400+ commits across 20+ releases; adopted as a vendor dependency by FRC teams worldwide.',
		'Built for FIRST Robotics teams, it has expanded to other robots as low-cost localization: less money, off-the-shelf parts, little expertise needed.',
		'Built the multi-language CI/CD pipeline on GitHub Actions: automated builds, doc generation and multi-target releases.'
	],
	stats: { stars: '140+', forks: '80+', commits: '400+', releases: '20+' }
};

export const frc = {
	org: 'FRC 5152',
	role: 'Software Team Lead',
	when: 'Oct 2022 – May 2026',
	where: 'Otsego, MI',
	notes: [
		'Taught myself Java and WPILib, then led software across four seasons, advancing to Software Lead.',
		'Managed and trained a team of seven, building a talent pipeline that outlasts me.',
		'Programmed autonomous and vision systems that earned 12+ awards; helped the team qualify for the FIRST World Championship twice.'
	],
	stats: { seasons: 4, team: 7, awards: '12+', worlds: 2 },
	/** Seasons as FRC game years. */
	seasons: ['2023', '2024', '2025', '2026']
};

export const cfa = {
	org: 'Chick-fil-A',
	role: 'Manager in Training (Shift Leader)',
	when: 'Jul 2023 – now',
	where: 'Kalamazoo, MI',
	notes: [
		'Coordinate positioning and workflow for a crew of 15 during peak hours, serving 500+ guests a day with speed of service under five minutes.',
		'Trained and onboarded new hires on food safety and brand standards: 100% health-inspection compliance.',
		'Resolve the disruptions every shift brings (equipment, staffing, order errors) to keep guest satisfaction above 88%.'
	],
	stats: { crew: 15, guestsPerDay: '500+', serviceMinutes: 5, trained: 2, inspection: '100%', satisfaction: '88%+' }
};

export const otsego = {
	org: 'Otsego Public Schools',
	role: 'IT Intern',
	when: 'Jun – Aug 2022',
	where: 'Otsego, MI',
	notes: [
		'Deployed 2,200+ Chromebooks across 5 schools in 8 weeks on a 4-person IT team.',
		'Automated enterprise enrollment with an Arduino keystroke-emulation tool, speeding throughput up 12×.',
		'Asset-tagged and logged every device into a central inventory database.'
	],
	stats: { devices: 2200, schools: 5, weeks: 8, team: 4, speedup: 12 }
};

export const gatech = {
	org: 'Georgia Institute of Technology',
	short: 'Georgia Tech',
	degree: 'B.S. Computer Engineering',
	when: 'Jun 2026 – expected 2030',
	gpa: '4.0',
	coursework: ['Digital Systems Design', 'Object-Oriented Programming'],
	teams: ['GT Propulsive Landers (avionics)', 'Chi Phi']
};

export const skills = {
	technical: [
		'Java',
		'C#',
		'Git',
		'OOP',
		'Computer vision',
		'Visual SLAM',
		'Sensor fusion',
		'Kalman filtering',
		'Robotics',
		'Autonomous systems',
		'Unity',
		'Protocol Buffers',
		'CI/CD',
		'Database admin'
	],
	professional: [
		'Team leadership',
		'Software project mgmt',
		'Problem solving',
		'Delegation',
		'Conflict resolution',
		'Time management',
		'Communication',
		'Coaching / onboarding',
		'Project coordination'
	]
};

export const leadership = [
	{ qty: '4 yr', item: 'Student Council Representative' },
	{ qty: '4 yr', item: 'Class Officer' },
	{ qty: '3 yr', item: 'FIRST Robotics Programming Team Captain' },
	{ qty: '2 yr', item: 'Chick-fil-A Shift Leader' },
	{ qty: '—', item: 'QuestNav Core Maintainer' }
];

export const activities = [
	'FIRST Robotics',
	'Boy Scouts: Eagle Scout, 2025',
	'Tennis',
	'National Honor Society',
	'Student Council',
	'Chi Phi Fraternity',
	'Georgia Tech Propulsive Landers, avionics'
];

/** The PDF resume served from static/. Note: it predates Speechify. */
export const resumePdf = 'Sean_Ernstes_Resume.pdf';
