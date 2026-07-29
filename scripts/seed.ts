// scripts/seed.ts
import db from '../src/lib/db';

const mockProspects = [
  { name: 'Sarah Connor', email: 'sarah@cyberdyne.io', company: 'Cyberdyne Systems', stage: 'NEW', notes: 'Interested in AI security solutions.' },
  { name: 'Bruce Wayne', email: 'bruce@wayneenterprises.com', company: 'Wayne Enterprises', stage: 'CONTACTED', next_action: 'Send follow-up deck', follow_up_date: '2026-08-01' },
  { name: 'Diana Prince', email: 'diana@themyscira.org', company: 'Themyscira Museum', stage: 'QUALIFIED', notes: 'Budget approved for Q3.' },
  { name: 'Tony Stark', email: 'tony@starkindustries.com', company: 'Stark Industries', stage: 'NEW', next_action: 'Initial discovery call' },
  { name: 'Peter Parker', email: 'peter@dailybugle.com', company: 'Daily Bugle', stage: 'CLOSED', notes: 'Lead cold for now.' }
];

// Using INSERT OR IGNORE avoids UNIQUE constraint errors when re-seeding
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO prospects (name, email, company, stage, notes, next_action, follow_up_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  for (const p of mockProspects) {
    insertStmt.run(p.name, p.email, p.company, p.stage, p.notes || null, p.next_action || null, p.follow_up_date || null);
  }
})();

console.log('✅ Seed process finished smoothly!');