import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

function seedDemoData(db: Database.Database): { adminId: number; demoId: number } {
  const ADMIN_USER = process.env.DEMO_ADMIN_USER || 'admin';
  const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@trek.app';
  const ADMIN_PASS = process.env.DEMO_ADMIN_PASS || 'admin12345';
  const DEMO_EMAIL = 'demo@trek.app';
  const DEMO_PASS = 'demo12345';

  // Create admin user if not exists
  let admin = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL) as { id: number } | undefined;
  if (!admin) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    const r = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(ADMIN_USER, ADMIN_EMAIL, hash, 'admin');
    admin = { id: Number(r.lastInsertRowid) };
    console.log('[Demo] Admin user created');
  } else {
    admin.id = Number(admin.id);
  }

  // Create demo user if not exists
  let demo = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as { id: number } | undefined;
  if (!demo) {
    const hash = bcrypt.hashSync(DEMO_PASS, 10);
    const r = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run('demo', DEMO_EMAIL, hash, 'user');
    demo = { id: Number(r.lastInsertRowid) };
    console.log('[Demo] Demo user created');
  } else {
    demo.id = Number(demo.id);
  }

  // Disable registration in demo mode
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('allow_registration', 'false')").run();

  // Check if admin already has example trips
  const adminTrips = db.prepare('SELECT COUNT(*) as count FROM trips WHERE user_id = ?').get(admin.id) as { count: number };
  if (adminTrips.count > 0) {
    console.log('[Demo] Example trips already exist, ensuring demo membership');
    ensureDemoMembership(db, admin.id, demo.id);
    // Seed any trips added since the baseline was created
    seedMissingTrips(db, admin.id, demo.id);
    return { adminId: admin.id, demoId: demo.id };
  }

  console.log('[Demo] Seeding example trips...');
  seedExampleTrips(db, admin.id, demo.id);

  // Auto-save baseline after first seed
  const { saveBaseline, hasBaseline } = require('./demo-reset');
  if (!hasBaseline()) {
    saveBaseline();
  }

  return { adminId: admin.id, demoId: demo.id };
}

function ensureDemoMembership(db: Database.Database, adminId: number, demoId: number): void {
  const trips = db.prepare('SELECT id FROM trips WHERE user_id = ?').all(adminId) as { id: number }[];
  const insertMember = db.prepare('INSERT OR IGNORE INTO trip_members (trip_id, user_id, invited_by) VALUES (?, ?, ?)');
  for (const trip of trips) {
    insertMember.run(trip.id, demoId, adminId);
  }
}

function seedExampleTrips(db: Database.Database, adminId: number, demoId: number): void {
  const insertTrip = db.prepare('INSERT INTO trips (user_id, title, description, start_date, end_date, currency) VALUES (?, ?, ?, ?, ?, ?)');
  const insertDay = db.prepare('INSERT INTO days (trip_id, day_number, date) VALUES (?, ?, ?)');
  const insertPlace = db.prepare('INSERT INTO places (trip_id, name, lat, lng, address, category_id, place_time, duration_minutes, notes, image_url, google_place_id, website, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertAssignment = db.prepare('INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, ?)');
  const insertPacking = db.prepare('INSERT INTO packing_items (trip_id, name, checked, category, sort_order) VALUES (?, ?, ?, ?, ?)');
  const insertBudget = db.prepare('INSERT INTO budget_items (trip_id, category, name, total_price, persons, note) VALUES (?, ?, ?, ?, ?, ?)');
  const insertReservation = db.prepare('INSERT INTO reservations (trip_id, day_id, title, reservation_time, confirmation_number, status, type, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMember = db.prepare('INSERT OR IGNORE INTO trip_members (trip_id, user_id, invited_by) VALUES (?, ?, ?)');
  const insertNote = db.prepare('INSERT INTO day_notes (day_id, trip_id, text, time, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

  // Category IDs: 1=Hotel, 2=Restaurant, 3=Attraction, 5=Transport, 7=Bar/Cafe, 8=Beach, 9=Nature, 6=Entertainment

  // --- Trip 1: Tokyo & Kyoto ---
  const trip1 = insertTrip.run(adminId, 'Tokyo & Kyoto', 'Two weeks in Japan — from the neon-lit streets of Tokyo to the serene temples of Kyoto.', '2026-04-15', '2026-04-21', 'JPY');
  const t1 = Number(trip1.lastInsertRowid);

  const t1days: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = insertDay.run(t1, i + 1, `2026-04-${15 + i}`);
    t1days.push(Number(d.lastInsertRowid));
  }

  const t1places: [number, string, number, number, string, number, string, number, string, string | null, string | null, string | null, string | null][] = [
    [t1, 'Hotel Shinjuku Granbell', 35.6938, 139.7035, '2-14-5 Kabukicho, Shinjuku City, Tokyo 160-0021, Japan', 1, '15:00', 60, 'Check-in from 3 PM. Steps from Shinjuku Station.', null, 'ChIJdaGEJBeMGGARYgt8sLBv6lM', 'https://www.grfranbellhotel.jp/shinjuku/', '+81 3-5155-2666'],
    [t1, 'Senso-ji Temple', 35.7148, 139.7967, '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan', 3, '09:00', 90, 'Oldest temple in Tokyo. Fewer tourists in the early morning.', null, 'ChIJ8T1GpMGOGGARDYGSgpoOdfg', 'https://www.senso-ji.jp/', '+81 3-3842-0181'],
    [t1, 'Shibuya Crossing', 35.6595, 139.7004, '2 Chome-2-1 Dogenzaka, Shibuya City, Tokyo 150-0043, Japan', 3, '18:00', 45, 'World\'s busiest pedestrian crossing. Most impressive at night.', null, 'ChIJLyzOhmyLGGARMKWbl5z6wGg', null, null],
    [t1, 'Tsukiji Outer Market', 35.6654, 139.7707, '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045, Japan', 2, '08:00', 120, 'Fresh sushi for breakfast! Explore the street food stalls.', null, 'ChIJq2i1dZCLGGAR1TfoBRo25VU', 'https://www.tsukiji.or.jp/', null],
    [t1, 'Meiji Jingu Shrine', 35.6764, 139.6993, '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557, Japan', 3, '10:00', 75, 'Peaceful oasis in the middle of the city. Walk through the forest to the shrine.', null, 'ChIJ5SuJSByMGGARMg9qOlTFgkc', 'https://www.meijijingu.or.jp/', '+81 3-3379-5511'],
    [t1, 'Akihabara Electric Town', 35.7023, 139.7745, 'Sotokanda, Chiyoda City, Tokyo, Japan', 3, '14:00', 180, 'Electric Town — anime, manga, electronics. Retro gaming shops!', null, 'ChIJGz1usEyMGGAR1mYByqOOJao', null, null],
    [t1, 'Shinkansen to Kyoto', 35.6812, 139.7671, '1 Chome Marunouchi, Chiyoda City, Tokyo 100-0005, Japan', 5, '08:30', 140, 'Nozomi Shinkansen, approx. 2h15. Window seat for Mt. Fuji views!', null, 'ChIJC3Cf2PuLGGAROO00ukl8JwA', null, null],
    [t1, 'Hotel Granvia Kyoto', 34.9856, 135.7580, 'Karasuma-dori Shiokoji-sagaru, Shimogyo-ku, Kyoto 600-8216, Japan', 1, '14:00', 60, 'Right at Kyoto Station. Perfect base for day trips.', null, 'ChIJUf6MDFcIAWARLihjKC9FWDY', 'https://www.granvia-kyoto.co.jp/', '+81 75-344-8888'],
    [t1, 'Fushimi Inari Taisha', 34.9671, 135.7727, '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto 612-0882, Japan', 3, '07:00', 150, '10,000 vermillion torii gates. Start early for empty paths!', null, 'ChIJIW0JRbMIAWARPYEzP5LVHGE', 'http://inari.jp/', '+81 75-641-7331'],
    [t1, 'Kinkaku-ji (Golden Pavilion)', 35.0394, 135.7292, '1 Kinkakujicho, Kita Ward, Kyoto 603-8361, Japan', 3, '10:00', 60, 'The golden temple reflected in the mirror pond. Iconic photo spot.', null, 'ChIJvUbrwCCoAWAR5-uyAXPzBHg', null, '+81 75-461-0013'],
    [t1, 'Arashiyama Bamboo Grove', 35.0095, 135.6673, 'Sagatenryuji Susukinobabacho, Ukyo Ward, Kyoto 616-8385, Japan', 9, '09:00', 90, 'Magical bamboo forest. Best visited in the morning before the crowds.', null, 'ChIJFS4EvA6pAWARQsAPVijvW7I', null, null],
    [t1, 'Nishiki Market', 35.0050, 135.7647, 'Nishiki-koji Dori, Nakagyo Ward, Kyoto 604-8054, Japan', 2, '12:00', 90, 'Kyoto\'s kitchen street. Try the matcha ice cream and fresh mochi!', null, 'ChIJ09zzUigJAWARXzIdh1NE3hQ', 'http://www.kyoto-nishiki.or.jp/', null],
    [t1, 'Gion District', 35.0037, 135.7755, 'Gionmachi Minamigawa, Higashiyama Ward, Kyoto 605-0074, Japan', 3, '17:00', 120, 'Historic geisha district. Best chance of spotting a maiko in the evening.', null, 'ChIJ7WWWjfYJAWARGqEHAfXIzgQ', null, null],
  ];

  const t1pIds = t1places.map(p => Number(insertPlace.run(...p).lastInsertRowid));

  // Day 1: Hotel Check-in, Shibuya
  insertAssignment.run(t1days[0], t1pIds[0], 0);
  insertAssignment.run(t1days[0], t1pIds[2], 1);
  insertNote.run(t1days[0], t1, 'Pick up Pocket WiFi at airport', '13:00', 'Info', 0.5);
  // Day 2: Tsukiji, Senso-ji, Akihabara
  insertAssignment.run(t1days[1], t1pIds[3], 0);
  insertAssignment.run(t1days[1], t1pIds[1], 1);
  insertAssignment.run(t1days[1], t1pIds[5], 2);
  // Day 3: Meiji Shrine, free afternoon
  insertAssignment.run(t1days[2], t1pIds[4], 0);
  insertNote.run(t1days[2], t1, 'Explore Harajuku after the shrine', '12:00', 'MapPin', 1);
  // Day 4: Shinkansen to Kyoto, Hotel
  insertAssignment.run(t1days[3], t1pIds[6], 0);
  insertAssignment.run(t1days[3], t1pIds[7], 1);
  insertNote.run(t1days[3], t1, 'Sit on right side for Mt. Fuji views!', '08:30', 'Train', 0.5);
  // Day 5: Fushimi Inari, Nishiki Market
  insertAssignment.run(t1days[4], t1pIds[8], 0);
  insertAssignment.run(t1days[4], t1pIds[11], 1);
  // Day 6: Kinkaku-ji, Arashiyama
  insertAssignment.run(t1days[5], t1pIds[9], 0);
  insertAssignment.run(t1days[5], t1pIds[10], 1);
  // Day 7: Gion
  insertAssignment.run(t1days[6], t1pIds[12], 0);
  insertNote.run(t1days[6], t1, 'Last evening — farewell dinner at Pontocho Alley', '19:00', 'Star', 1);

  // Packing
  const t1packing: [string, number, string, number][] = [
    ['Passport', 1, 'Documents', 0], ['Japan Rail Pass', 1, 'Documents', 1],
    ['Power adapter Type A/B', 0, 'Electronics', 2], ['Camera + charger', 0, 'Electronics', 3],
    ['Comfortable walking shoes', 0, 'Clothing', 4], ['Rain jacket', 0, 'Clothing', 5],
    ['Sunscreen', 0, 'Toiletries', 6], ['Travel first aid kit', 0, 'Toiletries', 7],
    ['Pocket WiFi confirmation', 1, 'Electronics', 8], ['Yen cash', 0, 'Documents', 9],
  ];
  t1packing.forEach(p => insertPacking.run(t1, ...p));

  // Budget
  insertBudget.run(t1, 'Accommodation', 'Hotel Shinjuku (3 nights)', 67500, 2, 'Double room');
  insertBudget.run(t1, 'Accommodation', 'Hotel Granvia Kyoto (4 nights)', 102000, 2, 'Superior room');
  insertBudget.run(t1, 'Transport', 'Flights FRA-NRT return', 180000, 2, 'Lufthansa direct');
  insertBudget.run(t1, 'Transport', 'Japan Rail Pass (7 days)', 57000, 2, 'Ordinary');
  insertBudget.run(t1, 'Food', 'Daily food budget', 52500, 2, 'Approx. 7,500 JPY/day');
  insertBudget.run(t1, 'Activities', 'Temple entries & experiences', 18000, 2, null);

  // Reservations
  insertReservation.run(t1, t1days[0], 'Hotel Shinjuku Check-in', '15:00', 'SG-2026-78432', 'confirmed', 'hotel', 'Shinjuku, Tokyo');
  insertReservation.run(t1, t1days[3], 'Shinkansen Tokyo → Kyoto', '08:30', 'JR-NOZOMI-445', 'confirmed', 'transport', 'Tokyo Station');

  insertMember.run(t1, demoId, adminId);

  // --- Trip 2: Barcelona Long Weekend ---
  const trip2 = insertTrip.run(adminId, 'Barcelona Long Weekend', 'Gaudi, tapas, and Mediterranean vibes — a long weekend in the Catalan capital.', '2026-05-21', '2026-05-24', 'EUR');
  const t2 = Number(trip2.lastInsertRowid);

  const t2days: number[] = [];
  for (let i = 0; i < 4; i++) {
    const d = insertDay.run(t2, i + 1, `2026-05-${21 + i}`);
    t2days.push(Number(d.lastInsertRowid));
  }

  const t2places: [number, string, number, number, string, number, string, number, string, string | null, string | null, string | null, string | null][] = [
    [t2, 'W Barcelona', 41.3686, 2.1920, 'Placa de la Rosa dels Vents 1, 08039 Barcelona, Spain', 1, '14:00', 60, 'Right on the beach. Rooftop bar with panoramic views!', null, 'ChIJKfj5C8yjpBIRCPC3RPI0JO4', 'https://www.marriott.com/hotels/travel/bcnwh-w-barcelona/', '+34 932 95 28 00'],
    [t2, 'Sagrada Familia', 41.4036, 2.1744, 'C/ de Mallorca, 401, 08013 Barcelona, Spain', 3, '10:00', 120, 'Gaudi\'s masterpiece. Book tickets online in advance — sells out fast!', null, 'ChIJk_s92NyipBIRUMnDG8Kq2Js', 'https://sagradafamilia.org/', '+34 932 08 04 14'],
    [t2, 'Park Guell', 41.4145, 2.1527, '08024 Barcelona, Spain', 3, '09:00', 90, 'Mosaic terrace with city views. Book early for the Monumental Zone.', null, 'ChIJ4eQMeOmipBIRb65JRUzGE8k', 'https://parkguell.barcelona/', '+34 934 09 18 31'],
    [t2, 'La Boqueria Market', 41.3816, 2.1717, 'La Rambla, 91, 08001 Barcelona, Spain', 2, '12:00', 75, 'Famous market on La Rambla. Fresh juice, jamon iberico, and seafood!', null, 'ChIJB_RfKcuipBIRkPKW7MzVGKg', 'http://www.boqueria.barcelona/', '+34 933 18 25 84'],
    [t2, 'Barceloneta Beach', 41.3784, 2.1925, 'Passeig Maritim de la Barceloneta, 08003 Barcelona, Spain', 8, '16:00', 120, 'City beach to unwind after sightseeing. Great chiringuitos nearby.', null, 'ChIJAQCl79-ipBIRUKF3myrMYkM', null, null],
    [t2, 'Gothic Quarter', 41.3834, 2.1762, 'Barri Gotic, 08002 Barcelona, Spain', 3, '15:00', 90, 'Medieval lanes, the cathedral, and Placa Reial. Get lost in the alleys!', null, 'ChIJ4_xkvv2ipBIRrK3bdd-lHgo', null, null],
    [t2, 'Casa Batllo', 41.3916, 2.1650, 'Passeig de Gracia, 43, 08007 Barcelona, Spain', 3, '11:00', 75, 'Gaudi\'s dragon house. The facade alone is worth the visit.', null, 'ChIJ-2VKIcaipBIRKK63H5PYjqQ', 'https://www.casabatllo.es/', '+34 932 16 03 06'],
    [t2, 'El Born & Tapas', 41.3856, 2.1825, 'El Born, 08003 Barcelona, Spain', 7, '20:00', 120, 'Trendy neighborhood with the best tapas bars. Try Cal Pep or El Xampanyet!', null, 'ChIJNY56dxuipBIRbqjSczmLvIA', null, null],
  ];

  const t2pIds = t2places.map(p => Number(insertPlace.run(...p).lastInsertRowid));

  // Day 1: Arrival, Beach, El Born
  insertAssignment.run(t2days[0], t2pIds[0], 0);
  insertAssignment.run(t2days[0], t2pIds[4], 1);
  insertAssignment.run(t2days[0], t2pIds[7], 2);
  // Day 2: Sagrada Familia, Casa Batllo, La Boqueria
  insertAssignment.run(t2days[1], t2pIds[1], 0);
  insertAssignment.run(t2days[1], t2pIds[6], 1);
  insertAssignment.run(t2days[1], t2pIds[3], 2);
  insertNote.run(t2days[1], t2, 'Tickets already booked for 10:00 AM slot', '09:30', 'Ticket', 0.5);
  // Day 3: Park Guell, Gothic Quarter
  insertAssignment.run(t2days[2], t2pIds[2], 0);
  insertAssignment.run(t2days[2], t2pIds[5], 1);
  // Day 4: Beach morning, departure
  insertAssignment.run(t2days[3], t2pIds[4], 0);
  insertNote.run(t2days[3], t2, 'Flight departs at 18:30 — leave hotel by 15:00', '14:00', 'Plane', 1);

  // Packing
  ['Passport', 'Sunscreen SPF50', 'Swimwear', 'Sunglasses', 'Comfortable sandals', 'Beach towel'].forEach((name, i) => {
    insertPacking.run(t2, name, 0, i < 1 ? 'Documents' : 'Summer', i);
  });

  // Budget
  insertBudget.run(t2, 'Accommodation', 'W Barcelona (3 nights)', 780, 2, 'Sea View Room');
  insertBudget.run(t2, 'Transport', 'Flights BER-BCN return', 180, 2, 'Eurowings');
  insertBudget.run(t2, 'Food', 'Restaurants & tapas', 300, 2, 'Approx. 75 EUR/day');
  insertBudget.run(t2, 'Activities', 'Sagrada Familia + Park Guell + Casa Batllo', 95, 2, 'Online tickets');

  insertReservation.run(t2, t2days[1], 'Sagrada Familia Entry', '10:00', 'SF-2026-11234', 'confirmed', 'activity', 'Eixample, Barcelona');

  insertMember.run(t2, demoId, adminId);

  // --- Trip 3: New York City ---
  const trip3 = insertTrip.run(adminId, 'New York City', 'The city that never sleeps — iconic landmarks, world-class food, and Broadway lights.', '2026-09-18', '2026-09-22', 'USD');
  const t3 = Number(trip3.lastInsertRowid);

  const t3days: number[] = [];
  for (let i = 0; i < 5; i++) {
    const d = insertDay.run(t3, i + 1, `2026-09-${18 + i}`);
    t3days.push(Number(d.lastInsertRowid));
  }

  const t3places: [number, string, number, number, string, number, string, number, string, string | null, string | null, string | null, string | null][] = [
    [t3, 'The Plaza Hotel', 40.7645, -73.9744, '768 5th Ave, New York, NY 10019, USA', 1, '15:00', 60, 'Iconic luxury hotel on Central Park. The lobby alone is worth a visit.', null, 'ChIJYbISlAVYwokRn6ORbSPV0xk', 'https://www.theplazany.com/', '+1 212-759-3000'],
    [t3, 'Statue of Liberty', 40.6892, -74.0445, 'Liberty Island, New York, NY 10004, USA', 3, '09:00', 180, 'Book crown access tickets months in advance. Ferry from Battery Park.', null, 'ChIJPTacEpBQwokRKwIlDXelxkA', 'https://www.nps.gov/stli/', '+1 212-363-3200'],
    [t3, 'Central Park', 40.7829, -73.9654, 'Central Park, New York, NY 10024, USA', 9, '10:00', 120, 'Bethesda Fountain, Bow Bridge, and Strawberry Fields. Rent bikes!', null, 'ChIJ4zGFAZpYwokRGUGph3Mf37k', 'https://www.centralparknyc.org/', null],
    [t3, 'Times Square', 40.7580, -73.9855, 'Manhattan, NY 10036, USA', 3, '19:00', 60, 'The crossroads of the world. Best experienced at night with all the lights.', null, 'ChIJmQJIxlVYwokRLgeuocVOGVU', 'https://www.timessquarenyc.org/', null],
    [t3, 'Empire State Building', 40.7484, -73.9857, '350 5th Ave, New York, NY 10118, USA', 3, '11:00', 90, '86th floor observation deck. Go at sunset for the best views.', null, 'ChIJaXQRs6lZwokRY6EFpJnhNNE', 'https://www.esbnyc.com/', '+1 212-736-3100'],
    [t3, 'Brooklyn Bridge', 40.7061, -73.9969, 'Brooklyn Bridge, New York, NY 10038, USA', 3, '16:00', 75, 'Walk from Manhattan to Brooklyn. DUMBO has great pizza and views.', null, 'ChIJK3vOQyNawokRXEYwET2GUtY', null, null],
    [t3, 'The Metropolitan Museum of Art', 40.7794, -73.9632, '1000 5th Ave, New York, NY 10028, USA', 3, '10:00', 180, 'One of the world\'s greatest art museums. Could spend days here.', null, 'ChIJb8Jg766MwokR1YWG0nV7k-E', 'https://www.metmuseum.org/', '+1 212-535-7710'],
    [t3, 'Joe\'s Pizza', 40.7309, -73.9969, '7 Carmine St, New York, NY 10014, USA', 2, '13:00', 30, 'New York\'s most famous pizza slice. Cash only, always a line, always worth it.', null, 'ChIJrfCL1IZZwokRwO3NKN22ZBc', 'http://www.joespizzanyc.com/', '+1 212-366-1182'],
    [t3, 'Top of the Rock', 40.7593, -73.9794, '30 Rockefeller Plaza, New York, NY 10112, USA', 3, '17:30', 60, 'Better views than Empire State because you can SEE the Empire State.', null, 'ChIJ_y2Fb1JYwokRT_iGzhTLdBo', 'https://www.topoftherocknyc.com/', '+1 212-698-2000'],
    [t3, 'Chelsea Market', 40.7424, -74.0061, '75 9th Ave, New York, NY 10011, USA', 2, '12:00', 90, 'Food hall in a converted factory. Lobster rolls, tacos, doughnuts, and more.', null, 'ChIJw2FNFyZZwokRcP9th_vIbkE', 'https://www.chelseamarket.com/', null],
    [t3, 'Broadway Show', 40.7590, -73.9845, 'Broadway, Manhattan, NY 10019, USA', 6, '20:00', 150, 'Can\'t visit NYC without seeing a show. Book TKTS booth for discounts.', null, 'ChIJMYQhxFtYwokR7cJBcNqfKDY', null, null],
  ];

  const t3pIds = t3places.map(p => Number(insertPlace.run(...p).lastInsertRowid));

  // Day 1: Arrival, Times Square, Broadway
  insertAssignment.run(t3days[0], t3pIds[0], 0);
  insertAssignment.run(t3days[0], t3pIds[3], 1);
  insertAssignment.run(t3days[0], t3pIds[10], 2);
  // Day 2: Statue of Liberty, Brooklyn Bridge, Joe's Pizza
  insertAssignment.run(t3days[1], t3pIds[1], 0);
  insertAssignment.run(t3days[1], t3pIds[5], 1);
  insertAssignment.run(t3days[1], t3pIds[7], 2);
  insertNote.run(t3days[1], t3, 'First ferry at 8:30 AM — arrive early at Battery Park', '08:00', 'Ship', 0.5);
  // Day 3: Central Park, Met Museum, Top of the Rock sunset
  insertAssignment.run(t3days[2], t3pIds[2], 0);
  insertAssignment.run(t3days[2], t3pIds[6], 1);
  insertAssignment.run(t3days[2], t3pIds[8], 2);
  // Day 4: Empire State Building, Chelsea Market, shopping
  insertAssignment.run(t3days[3], t3pIds[4], 0);
  insertAssignment.run(t3days[3], t3pIds[9], 1);
  insertNote.run(t3days[3], t3, 'SoHo and 5th Avenue shopping in the afternoon', '14:00', 'ShoppingBag', 1.5);
  // Day 5: Free morning, departure
  insertNote.run(t3days[4], t3, 'Flight departs JFK at 17:00 — last bagel at Russ & Daughters!', '10:00', 'Plane', 0);

  // Packing
  const t3packing: [string, number, string, number][] = [
    ['Passport', 1, 'Documents', 0], ['ESTA confirmation', 1, 'Documents', 1],
    ['Travel insurance', 0, 'Documents', 2], ['Comfortable sneakers', 0, 'Clothing', 3],
    ['Light jacket', 0, 'Clothing', 4], ['Portable charger', 0, 'Electronics', 5],
    ['Camera', 0, 'Electronics', 6], ['Subway card (OMNY)', 0, 'Transport', 7],
  ];
  t3packing.forEach(p => insertPacking.run(t3, ...p));

  // Budget
  insertBudget.run(t3, 'Accommodation', 'The Plaza Hotel (4 nights)', 2400, 2, 'Park View Room');
  insertBudget.run(t3, 'Transport', 'Flights FRA-JFK return', 850, 2, 'United Airlines');
  insertBudget.run(t3, 'Food', 'Daily food budget', 500, 2, 'Approx. 100 USD/day');
  insertBudget.run(t3, 'Activities', 'Statue of Liberty + Empire State + Top of the Rock + Met', 180, 2, 'CityPASS');
  insertBudget.run(t3, 'Entertainment', 'Broadway show tickets', 300, 2, 'Hamilton or Wicked');

  insertReservation.run(t3, t3days[0], 'The Plaza Hotel Check-in', '15:00', 'PZ-2026-55891', 'confirmed', 'hotel', '768 5th Ave, New York');
  insertReservation.run(t3, t3days[0], 'Broadway Show', '20:00', 'BW-HAM-2026-1192', 'pending', 'activity', 'Richard Rodgers Theatre');
  insertReservation.run(t3, t3days[1], 'Statue of Liberty Ferry', '08:30', 'SOL-2026-3347', 'confirmed', 'transport', 'Battery Park');

  insertMember.run(t3, demoId, adminId);

  seedMadeInJapan(db, adminId, demoId);

  console.log('[Demo] 4 example trips seeded and shared with demo user');
}

function seedMissingTrips(db: Database.Database, adminId: number, demoId: number): void {
  const existing = db.prepare('SELECT title FROM trips WHERE user_id = ?').all(adminId) as { title: string }[];
  const titles = new Set(existing.map(r => r.title));
  if (!titles.has('Made in Japan')) {
    seedMadeInJapan(db, adminId, demoId);
    console.log('[Demo] Seeded missing trip: Made in Japan');
  }
}

function seedMadeInJapan(db: Database.Database, adminId: number, demoId: number): void {
  const insertTrip = db.prepare('INSERT INTO trips (user_id, title, description, start_date, end_date, currency) VALUES (?, ?, ?, ?, ?, ?)');
  const insertDay = db.prepare('INSERT INTO days (trip_id, day_number, date) VALUES (?, ?, ?)');
  const insertPlace = db.prepare('INSERT INTO places (trip_id, name, lat, lng, address, category_id, place_time, duration_minutes, notes, image_url, google_place_id, website, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertAssignment = db.prepare('INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, ?)');
  const insertMember = db.prepare('INSERT OR IGNORE INTO trip_members (trip_id, user_id, invited_by) VALUES (?, ?, ?)');

  const trip4 = insertTrip.run(adminId, 'Made in Japan', 'An epic journey across Japan — from Hokkaido\'s flower fields to Okinawa\'s beaches, through hidden gorges, ancient temples, and steaming onsens.', '2026-09-01', '2026-09-30', 'JPY');
  const t4 = Number(trip4.lastInsertRowid);

  const t4days: number[] = [];
  for (let i = 0; i < 30; i++) {
    const d = insertDay.run(t4, i + 1, `2026-09-${String(i + 1).padStart(2, '0')}`);
    t4days.push(Number(d.lastInsertRowid));
  }

  const t4places: [number, string, number, number, string, number, string, number, string, string | null, string | null, string | null, string | null][] = [
    // Hokkaido
    [t4, 'Shikisai-no-oka', 43.5542, 142.4667, 'Biei, Kamikawa District, Hokkaido, Japan', 9, '10:00', 120, 'Colorful flower fields rolling across hillsides in Biei. Best in late summer.', null, null, null, null],
    [t4, 'Rebun Island', 45.3500, 141.0333, 'Rebun, Rebun District, Hokkaido, Japan', 9, '08:00', 480, 'Remote island known for rare alpine wildflowers. Ferry from Wakkanai.', null, null, null, null],
    // Tokyo / Kanto
    [t4, 'Senso-ji Temple', 35.7148, 139.7967, '2-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan', 3, '07:00', 90, 'Tokyo\'s oldest and most visited temple. Early morning visit avoids the crowds.', null, null, null, null],
    [t4, 'Toyosu Manyo Club', 35.6478, 139.7759, '2-1-1 Toyosu, Koto City, Tokyo 135-0061, Japan', 6, '14:00', 180, 'Rooftop hot spring with views over Rainbow Bridge and Tokyo Bay.', null, null, null, null],
    [t4, 'Eteco Bread', 35.7028, 139.6028, 'Nishiogikubo, Suginami City, Tokyo, Japan', 7, '09:00', 45, 'Artisan bakery with intricate bread sculptures inspired by anime and nature.', null, null, null, null],
    [t4, 'Sagamiko Illumilion', 35.6150, 139.1550, 'Sagamiko, Sagamihara, Kanagawa, Japan', 6, '18:00', 90, 'Dazzling lakeside illumination event — one of Japan\'s largest winter light shows.', null, null, null, null],
    [t4, 'Nokogiriyama', 35.1167, 139.8333, 'Nokogiriyama, Kyonan, Awa District, Chiba, Japan', 9, '09:00', 180, 'Saw-tooth mountain with a giant Buddha and sweeping views of Tokyo Bay. Take the ropeway.', null, null, null, null],
    // Tochigi
    [t4, 'Nakagawa-machi', 36.7492, 140.0253, 'Nakagawa-machi, Naka District, Tochigi, Japan', 9, '10:00', 120, 'Scenic town in Tochigi with seasonal flowers and traditional countryside scenery.', null, null, null, null],
    [t4, 'Masao Higuchi Wisteria Garden', 36.2811, 139.5164, 'Tochigi, Japan', 9, '10:00', 90, 'Breathtaking private wisteria garden — a canopy of purple blooms in late April.', null, null, null, null],
    // Gunma
    [t4, 'Kusatsu Onsen', 36.6203, 138.5969, 'Kusatsu, Agatsuma District, Gunma, Japan', 6, '15:00', 180, 'One of Japan\'s premier hot spring resorts. The sulfurous Yubatake grass field is iconic.', null, null, null, null],
    [t4, 'Onioshidashi Park', 36.5414, 138.6706, 'Kita-Asakamachi, Agatsuma District, Gunma, Japan', 9, '09:00', 90, 'Ancient lava field at the foot of Mt. Asama — eerie moonscape landscape amid wildflowers.', null, null, null, null],
    [t4, 'Mizusawa Kannon', 36.4672, 138.8947, 'Ikaho, Kitagunma District, Gunma, Japan', 3, '09:00', 60, 'Hilltop Buddhist temple near Ikaho Onsen with fine mountain views and serene corridors.', null, null, null, null],
    [t4, 'Shima Onsen', 36.7600, 138.7900, 'Nakanojo, Agatsuma District, Gunma, Japan', 6, '15:00', 180, 'Secluded river valley onsen town — said to be one of the inspirations for Spirited Away.', null, null, null, null],
    [t4, 'Onsen Sanso Daikon no Hana', 36.7650, 138.7950, 'Nakanojo, Agatsuma District, Gunma, Japan', 1, '16:00', 60, 'Rustic mountain inn near Shima Onsen with a cosy atmosphere and therapeutic open-air baths.', null, null, null, null],
    // Fukushima
    [t4, 'Inawashiro Herb Garden', 37.5500, 140.0333, 'Inawashiro, Yama District, Fukushima, Japan', 9, '10:00', 90, 'Terraced herb and flower gardens on Mt. Bandai slopes with panoramic Lake Inawashiro views.', null, null, null, null],
    // Nagano
    [t4, 'Kamikochi', 36.2398, 137.6428, 'Kamikochi, Matsumoto, Nagano, Japan', 9, '07:00', 360, 'Sacred alpine valley — Kappa Bridge, turquoise Azusa River, and the Northern Alps backdrop.', null, null, null, null],
    [t4, 'Togakushi Shrine', 36.7833, 138.0667, 'Togakushi, Nagano City, Nagano, Japan', 3, '08:00', 120, 'Ancient mountain shrine reached via a 2km avenue of towering cedar trees.', null, null, null, null],
    [t4, 'Narai-juku', 36.0059, 137.8678, 'Narai, Shiojiri, Nagano, Japan', 3, '11:00', 90, 'Best-preserved post town on the Nakasendo highway — feels frozen in the Edo period.', null, null, null, null],
    [t4, 'Magome-juku', 35.5167, 137.5667, 'Magome, Nakatsugawa, Gifu, Japan', 3, '10:00', 90, 'Hillside post town and start of the scenic Nakasendo walk to Tsumago. Cobblestones and old inns.', null, null, null, null],
    // Gifu
    [t4, 'Shirakawa-go', 36.2558, 136.9058, 'Ogimachi, Shirakawa, Ono District, Gifu, Japan', 3, '10:00', 150, 'UNESCO-listed gassho-zukuri farmhouses — snow-laden rooftops are iconic in winter.', null, null, null, null],
    [t4, 'Hida Folk Village', 36.1503, 137.2504, '1-590 Kamiokamotocho, Takayama, Gifu, Japan', 3, '10:00', 120, 'Open-air museum of traditional thatched farmhouses moved from across the Hida region.', null, null, null, null],
    [t4, 'Takayama Sanmachi Historic District', 36.1417, 137.2558, 'Sanmachi, Takayama, Gifu, Japan', 3, '09:00', 120, 'Beautifully preserved Edo merchant town — sake breweries, craft shops, and morning markets.', null, null, null, null],
    [t4, 'Gero Onsen Onsenji', 35.8048, 137.2440, 'Gero, Gifu, Japan', 3, '08:00', 60, 'Hilltop temple above Gero Onsen with foot baths and panoramic views of the Hida River valley.', null, null, null, null],
    [t4, 'Gero Onsen Yunoshimakan', 35.8067, 137.2444, 'Gero, Gifu, Japan', 1, '15:00', 60, 'Historic riverside ryokan in one of Japan\'s three great onsen towns.', null, null, null, null],
    [t4, "Monet's Pond", 35.7500, 136.7167, 'Akechi-cho, Ena, Gifu, Japan', 9, '09:00', 60, 'Spring-fed pond of astonishing clarity — plants and koi appear to float in mid-air like a Monet painting.', null, null, null, null],
    [t4, 'Tsukechi Gorge', 35.6167, 137.4167, 'Tsukechi, Nakatsugawa, Gifu, Japan', 9, '10:00', 90, 'Lush emerald gorge with traditional suspension bridges and cool mist from the rapids below.', null, null, null, null],
    [t4, 'Ryujin Falls', 35.5500, 137.0000, 'Gifu, Japan', 9, '09:00', 60, 'Powerful hidden waterfall deep in Gifu\'s cedar forests — one of the prefecture\'s secret gems.', null, null, null, null],
    // Aichi
    [t4, 'Kiyosu Castle', 35.1983, 136.8447, 'Kiyosu, Aichi, Japan', 3, '10:00', 60, 'Elegantly white reconstructed castle that served as Oda Nobunaga\'s strategic base.', null, null, null, null],
    [t4, 'Panel Café Nagoya Station', 35.1706, 136.8816, 'Nagoya Station area, Nagoya, Aichi, Japan', 7, '08:00', 60, 'Kissaten-style café embodying Nagoya\'s famed morning culture — coffee comes with generous free toast.', null, null, null, null],
    [t4, 'Sky Garden', 35.0522, 136.8834, 'Nagoya, Aichi, Japan', 9, '14:00', 90, 'Rooftop garden with panoramic views across Nagoya and Ise Bay.', null, null, null, null],
    [t4, 'Chita Bamboo Forest', 34.9042, 136.8898, 'Chita Peninsula, Aichi, Japan', 9, '10:00', 60, 'Atmospheric bamboo grove on the Chita Peninsula — cool green light filters through the towering stalks.', null, null, null, null],
    // Fukui
    [t4, 'Echizen Daibutsu', 35.9714, 136.1852, 'Echizen, Fukui, Japan', 3, '10:00', 60, 'One of Japan\'s largest Great Buddha statues, set in a serene wooded hillside compound.', null, null, null, null],
    [t4, 'Myotsu-ji', 35.5333, 135.9167, 'Obama, Fukui, Japan', 3, '09:00', 60, 'Ancient temple with a three-story pagoda framed by maples — spectacular in autumn colour.', null, null, null, null],
    // Shiga
    [t4, 'Hyakusai-ji Temple', 35.2117, 136.3194, 'Higashiomi, Shiga, Japan', 3, '09:00', 90, 'Thousand-year-old temple on Mt. Kinugasa — famous for its ancient wisteria and brilliant autumn foliage.', null, null, null, null],
    [t4, 'Konsho-ji Temple', 35.2300, 136.2600, 'Shiga, Japan', 3, '10:00', 60, 'Garden temple known for summer hydrangeas and fiery autumn maples along stone-paved paths.', null, null, null, null],
    [t4, 'Sunken Torii of Benten Pond', 35.2833, 136.1583, 'Nagahama, Shiga, Japan', 3, '08:00', 60, 'Stone torii gate that appears to rise from a glassy pond — especially magical at dawn.', null, null, null, null],
    [t4, 'Yokokuraji', 34.9700, 136.2900, 'Shiga, Japan', 3, '09:00', 60, 'Remote mountaintop temple with ancient stone-carved Buddhas and sweeping valley views.', null, null, null, null],
    // Kyoto
    [t4, 'Byodo-in Temple', 34.8889, 135.8076, '116 Renge, Uji, Kyoto 611-0021, Japan', 3, '09:00', 90, 'UNESCO-listed Phoenix Hall reflected in its mirror pond — the temple on the 10-yen coin. Special autumn night viewing: Shoko shoan kanji no Akari.', null, null, null, null],
    [t4, 'Kiyomizu-dera', 34.9949, 135.7851, '1-294 Kiyomizu, Higashiyama Ward, Kyoto, Japan', 3, '07:00', 90, 'Iconic hilltop temple with a wooden stage jutting over the valley. Misty views at dawn.', null, null, null, null],
    [t4, 'Keishun-in Temple / Green Zen Garden', 35.0261, 135.7230, 'Myoshinji, Ukyo Ward, Kyoto, Japan', 3, '10:00', 60, 'Intimate Myoshinji sub-temple with a celebrated moss-and-stone zen garden.', null, null, null, null],
    [t4, 'Joshoko-ji Temple', 35.0100, 135.7500, 'Kyoto, Japan', 3, '11:00', 60, 'Peaceful mountain temple near Kyoto with beautiful seasonal gardens.', null, null, null, null],
    [t4, 'Sagenta Kifune', 35.1167, 135.7500, 'Kibune, Sakyo Ward, Kyoto, Japan', 2, '12:00', 120, 'Kawadoko river-platform dining in Kibune — tables built over a cool mountain stream, perfect in summer.', null, null, null, null],
    // Nara
    [t4, 'Hasedera Temple', 34.5320, 135.9062, 'Hase, Sakurai, Nara, Japan', 3, '09:00', 90, 'Temple of peonies and wisteria on a misty hillside, with a long covered wooden stairway to the main hall.', null, null, null, null],
    [t4, 'Hozan-ji Temple', 34.5942, 135.6706, 'Shigi, Heguri, Ikoma District, Nara, Japan', 3, '09:00', 60, 'Hilltop temple on Mt. Shigi with a tiger legend and panoramic views over the Yamato Plain.', null, null, null, null],
    [t4, 'Tsubosaka-dera', 34.4572, 135.8250, 'Tsubosaka, Takatori, Takaichi District, Nara, Japan', 3, '10:00', 60, 'Temple dedicated to healing eyesight, with giant Indian-style stone carvings in the grounds.', null, null, null, null],
    // Osaka
    [t4, 'Hello Donuts', 34.6937, 135.5023, 'Osaka, Japan', 7, '10:00', 30, 'Artisan donut shop with photogenic seasonal creations and beautiful presentation.', null, null, null, null],
    // Mie
    [t4, 'Taki Shrine', 34.4833, 136.5833, 'Taki, Taki District, Mie, Japan', 3, '09:00', 60, 'Ancient shrine tucked into cedar forests of Mie, with a sacred waterfall nearby.', null, null, null, null],
    // Wakayama
    [t4, 'Niutsuhime Shrine', 34.3267, 135.3597, 'Katsuragi, Ito District, Wakayama, Japan', 3, '10:00', 60, 'Head shrine of the deity who guided Kukai to Mount Koya — set in ancient cryptomeria forest.', null, null, null, null],
    [t4, 'Mount Koya', 34.2126, 135.5886, 'Koya, Ito District, Wakayama, Japan', 3, '09:00', 360, 'Sacred Shingon Buddhist mountain. Okunoin cemetery at dawn is one of Japan\'s most spiritual experiences. Stay overnight in a shukubo temple lodging.', null, null, null, null],
    [t4, 'Kayasan', 34.2800, 135.6000, 'Wakayama, Japan', 9, '08:00', 180, 'Sacred mountain with ancient cedar forests, waterfalls, and deep Buddhist significance.', null, null, null, null],
    [t4, 'Nachi Falls', 33.6617, 135.9894, 'Nachikatsuura, Higashimuro District, Wakayama, Japan', 9, '08:00', 90, 'Japan\'s tallest waterfall at 133m. Part of the Kumano Kodo pilgrimage. Kumano Nachi Taisha shrine is adjacent.', null, null, null, null],
    [t4, 'Ishiyama Temple', 34.2500, 135.2500, 'Wakayama, Japan', 3, '10:00', 60, 'Sacred temple where Lady Murasaki is said to have been inspired to write The Tale of Genji.', null, null, null, null],
    [t4, 'Motojima Shrine', 33.8500, 135.4500, 'Wakayama, Japan', 3, '10:00', 60, 'Hidden mountain shrine deep in the Wakayama forests with a mystical, secluded atmosphere.', null, null, null, null],
    // Shimane / Tokushima
    [t4, 'Iwami Ginzan', 35.1000, 132.4333, 'Omori, Oda, Shimane, Japan', 3, '10:00', 120, 'UNESCO-listed silver mine — once provided a third of the world\'s silver. Quiet whitewashed historic lanes.', null, null, null, null],
    [t4, 'Udatsu Wall Historical District', 34.0563, 134.1478, 'Mima, Tokushima, Japan', 3, '10:00', 90, 'Preserved Edo-era merchant town famous for its distinctive udatsu fire-break walls.', null, null, null, null],
    // Fukuoka
    [t4, 'Amam Dacotan Ghibli Bakery', 33.5892, 130.3949, 'Fukuoka, Japan', 7, '09:00', 60, 'One of Japan\'s most celebrated artisan bakeries — a visual feast of bread sculptures. Expect queues.', null, null, null, null],
    // Kumamoto
    [t4, 'Kamishikimi Kumanoimasu Shrine', 32.9175, 130.8158, 'Yamato, Kamimashiki District, Kumamoto, Japan', 3, '09:00', 90, 'Mossy stone steps winding through ancient forest to a lantern-lined hilltop shrine.', null, null, null, null],
    [t4, 'Kurokawa Onsen', 33.0378, 131.1563, 'Minami-Oguni, Aso District, Kumamoto, Japan', 6, '13:00', 240, 'One of Japan\'s most beloved onsen villages. Buy a bath-pass and hop between riverside ryokan baths.', null, null, null, null],
    // Miyazaki
    [t4, 'Amano Yasugawara', 32.6891, 131.2939, 'Takachiho, Nishiusuki District, Miyazaki, Japan', 3, '09:00', 60, 'River cave where the sun goddess hid — thousands of small stone piles line the mossy path.', null, null, null, null],
    [t4, 'Takachiho Gorge', 32.7083, 131.3083, 'Takachiho, Nishiusuki District, Miyazaki, Japan', 9, '08:00', 120, 'Spectacular V-shaped basalt gorge. Hire a rowboat to glide under the Manai Falls.', null, null, null, null],
    [t4, 'Udo Jingu', 31.5667, 131.4167, 'Nichinan, Miyazaki, Japan', 3, '09:00', 60, 'Dramatic shrine built into a sea cave on the Pacific coast. Throw clay balls into a hollow rock for luck.', null, null, null, null],
    // Kagoshima
    [t4, 'Kirishima Jingu', 31.9267, 130.8644, 'Kirishima, Kagoshima, Japan', 3, '09:00', 90, 'Ancient Shinto shrine at the foot of volcanic Mt. Kirishima — vivid crimson torii gates amid cedar forest.', null, null, null, null],
    // Okinawa
    [t4, 'Fukushuen Garden', 26.2167, 127.6833, 'Naha, Okinawa, Japan', 9, '10:00', 90, 'Chinese-style garden celebrating the historic ties between Naha and Fuzhou, with pavilions and koi ponds.', null, null, null, null],
    [t4, 'Sosu Beach', 26.1500, 127.6500, 'Okinawa, Japan', 8, '11:00', 180, 'Crystal-clear turquoise waters on one of Okinawa\'s unspoiled sandy beaches.', null, null, null, null],
  ];

  const t4pIds = t4places.map(p => Number(insertPlace.run(...p).lastInsertRowid));

  // Day 1: Shikisai-no-oka, Rebun Island (Hokkaido)
  insertAssignment.run(t4days[0], t4pIds[0], 0);
  insertAssignment.run(t4days[0], t4pIds[1], 1);
  // Day 2: Senso-ji, Toyosu Manyo Club (Tokyo)
  insertAssignment.run(t4days[1], t4pIds[2], 0);
  insertAssignment.run(t4days[1], t4pIds[3], 1);
  // Day 3: Eteco Bread, Sagamiko Illumilion
  insertAssignment.run(t4days[2], t4pIds[4], 0);
  insertAssignment.run(t4days[2], t4pIds[5], 1);
  // Day 4: Nokogiriyama (Chiba)
  insertAssignment.run(t4days[3], t4pIds[6], 0);
  // Day 5: Nakagawa-machi, Masao Higuchi Wisteria Garden (Tochigi)
  insertAssignment.run(t4days[4], t4pIds[7], 0);
  insertAssignment.run(t4days[4], t4pIds[8], 1);
  // Day 6: Kusatsu Onsen, Onioshidashi Park (Gunma)
  insertAssignment.run(t4days[5], t4pIds[9], 0);
  insertAssignment.run(t4days[5], t4pIds[10], 1);
  // Day 7: Mizusawa Kannon, Shima Onsen, Onsen Sanso Daikon no Hana (Gunma)
  insertAssignment.run(t4days[6], t4pIds[11], 0);
  insertAssignment.run(t4days[6], t4pIds[12], 1);
  insertAssignment.run(t4days[6], t4pIds[13], 2);
  // Day 8: Inawashiro Herb Garden (Fukushima)
  insertAssignment.run(t4days[7], t4pIds[14], 0);
  // Day 9: Kamikochi, Togakushi Shrine (Nagano)
  insertAssignment.run(t4days[8], t4pIds[15], 0);
  insertAssignment.run(t4days[8], t4pIds[16], 1);
  // Day 10: Narai-juku, Magome-juku (Nagano/Gifu)
  insertAssignment.run(t4days[9], t4pIds[17], 0);
  insertAssignment.run(t4days[9], t4pIds[18], 1);
  // Day 11: Shirakawa-go, Hida Folk Village (Gifu)
  insertAssignment.run(t4days[10], t4pIds[19], 0);
  insertAssignment.run(t4days[10], t4pIds[20], 1);
  // Day 12: Takayama Sanmachi, Gero Onsen Onsenji, Gero Onsen Yunoshimakan (Gifu)
  insertAssignment.run(t4days[11], t4pIds[21], 0);
  insertAssignment.run(t4days[11], t4pIds[22], 1);
  insertAssignment.run(t4days[11], t4pIds[23], 2);
  // Day 13: Monet's Pond, Tsukechi Gorge, Ryujin Falls (Gifu)
  insertAssignment.run(t4days[12], t4pIds[24], 0);
  insertAssignment.run(t4days[12], t4pIds[25], 1);
  insertAssignment.run(t4days[12], t4pIds[26], 2);
  // Day 14: Kiyosu Castle, Panel Café Nagoya Station, Sky Garden (Aichi)
  insertAssignment.run(t4days[13], t4pIds[27], 0);
  insertAssignment.run(t4days[13], t4pIds[28], 1);
  insertAssignment.run(t4days[13], t4pIds[29], 2);
  // Day 15: Chita Bamboo Forest (Aichi)
  insertAssignment.run(t4days[14], t4pIds[30], 0);
  // Day 16: Echizen Daibutsu, Myotsu-ji (Fukui)
  insertAssignment.run(t4days[15], t4pIds[31], 0);
  insertAssignment.run(t4days[15], t4pIds[32], 1);
  // Day 17: Hyakusai-ji Temple, Konsho-ji Temple, Sunken Torii of Benten Pond (Shiga)
  insertAssignment.run(t4days[16], t4pIds[33], 0);
  insertAssignment.run(t4days[16], t4pIds[34], 1);
  insertAssignment.run(t4days[16], t4pIds[35], 2);
  // Day 18: Yokokuraji (Shiga), Byodo-in Temple (Kyoto/Uji)
  insertAssignment.run(t4days[17], t4pIds[36], 0);
  insertAssignment.run(t4days[17], t4pIds[37], 1);
  // Day 19: Kiyomizu-dera, Keishun-in Temple, Joshoko-ji Temple (Kyoto)
  insertAssignment.run(t4days[18], t4pIds[38], 0);
  insertAssignment.run(t4days[18], t4pIds[39], 1);
  insertAssignment.run(t4days[18], t4pIds[40], 2);
  // Day 20: Sagenta Kifune (Kyoto)
  insertAssignment.run(t4days[19], t4pIds[41], 0);
  // Day 21: Hasedera Temple, Hozan-ji Temple, Tsubosaka-dera (Nara)
  insertAssignment.run(t4days[20], t4pIds[42], 0);
  insertAssignment.run(t4days[20], t4pIds[43], 1);
  insertAssignment.run(t4days[20], t4pIds[44], 2);
  // Day 22: Hello Donuts (Osaka), Taki Shrine (Mie)
  insertAssignment.run(t4days[21], t4pIds[45], 0);
  insertAssignment.run(t4days[21], t4pIds[46], 1);
  // Day 23: Niutsuhime Shrine, Mount Koya, Kayasan (Wakayama)
  insertAssignment.run(t4days[22], t4pIds[47], 0);
  insertAssignment.run(t4days[22], t4pIds[48], 1);
  insertAssignment.run(t4days[22], t4pIds[49], 2);
  // Day 24: Nachi Falls, Ishiyama Temple, Motojima Shrine (Wakayama)
  insertAssignment.run(t4days[23], t4pIds[50], 0);
  insertAssignment.run(t4days[23], t4pIds[51], 1);
  insertAssignment.run(t4days[23], t4pIds[52], 2);
  // Day 25: Iwami Ginzan (Shimane), Udatsu Wall Historical District (Tokushima)
  insertAssignment.run(t4days[24], t4pIds[53], 0);
  insertAssignment.run(t4days[24], t4pIds[54], 1);
  // Day 26: Amam Dacotan Ghibli Bakery (Fukuoka)
  insertAssignment.run(t4days[25], t4pIds[55], 0);
  // Day 27: Kamishikimi Kumanoimasu Shrine, Kurokawa Onsen (Kumamoto)
  insertAssignment.run(t4days[26], t4pIds[56], 0);
  insertAssignment.run(t4days[26], t4pIds[57], 1);
  // Day 28: Amano Yasugawara, Takachiho Gorge, Udo Jingu (Miyazaki)
  insertAssignment.run(t4days[27], t4pIds[58], 0);
  insertAssignment.run(t4days[27], t4pIds[59], 1);
  insertAssignment.run(t4days[27], t4pIds[60], 2);
  // Day 29: Kirishima Jingu (Kagoshima)
  insertAssignment.run(t4days[28], t4pIds[61], 0);
  // Day 30: Fukushuen Garden, Sosu Beach (Okinawa)
  insertAssignment.run(t4days[29], t4pIds[62], 0);
  insertAssignment.run(t4days[29], t4pIds[63], 1);

  insertMember.run(t4, demoId, adminId);
}

export { seedDemoData };
