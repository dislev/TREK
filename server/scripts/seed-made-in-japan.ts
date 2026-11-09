/**
 * Seed script: adds all "Made in Japan" places to trip id=1.
 *
 * Usage (from repo root):
 *   cd server && node --import tsx scripts/seed-made-in-japan.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/travel.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const TRIP_ID = 1;

// ── Verify the trip exists ───────────────────────────────────────────────────
const trip = db.prepare('SELECT id, title FROM trips WHERE id = ?').get(TRIP_ID) as { id: number; title: string } | undefined;
if (!trip) {
  console.error(`Trip ${TRIP_ID} not found. Aborting.`);
  process.exit(1);
}
console.log(`Found trip: "${trip.title}" (id=${trip.id})`);

// ── Check for existing places ────────────────────────────────────────────────
const placeCount = (db.prepare('SELECT COUNT(*) as c FROM places WHERE trip_id = ?').get(TRIP_ID) as { c: number }).c;
if (placeCount > 0) {
  console.log(`Trip already has ${placeCount} places. Aborting to avoid duplicates.`);
  process.exit(0);
}

// ── Extend to 30 days if needed ──────────────────────────────────────────────
const existingDays = db.prepare('SELECT id, day_number, date FROM days WHERE trip_id = ? ORDER BY day_number').all(TRIP_ID) as { id: number; day_number: number; date: string }[];
const dayIds: number[] = existingDays.map(d => d.id);

const insertDay = db.prepare('INSERT INTO days (trip_id, day_number, date) VALUES (?, ?, ?)');

if (existingDays.length < 30) {
  // Determine start date from last existing day and extend
  const lastDate = existingDays.length > 0 ? new Date(existingDays[existingDays.length - 1].date + 'T00:00:00Z') : new Date('2026-11-10T00:00:00Z');
  const startDayNumber = existingDays.length + 1;

  for (let i = 0; i < 30 - existingDays.length; i++) {
    const nextDate = new Date(lastDate.getTime() + (i + 1) * 86400000);
    const dateStr = nextDate.toISOString().slice(0, 10);
    const r = insertDay.run(TRIP_ID, startDayNumber + i, dateStr);
    dayIds.push(Number(r.lastInsertRowid));
  }
  console.log(`Extended trip to 30 days (added ${30 - existingDays.length} new days)`);
}

// ── Category IDs: 1=Hotel 2=Restaurant 3=Attraction 6=Activity 7=Bar/Cafe 8=Beach 9=Nature ──
type PlaceRow = [number, string, number, number, string, number, string, number, string, null, null, null, null];

const places: PlaceRow[] = [
  // Hokkaido
  [TRIP_ID, 'Shikisai-no-oka', 43.5542, 142.4667, 'Biei, Kamikawa District, Hokkaido, Japan', 9, '10:00', 120, 'Colorful flower fields rolling across hillsides in Biei. Best in late summer.', null, null, null, null],
  [TRIP_ID, 'Rebun Island', 45.3500, 141.0333, 'Rebun, Rebun District, Hokkaido, Japan', 9, '08:00', 480, 'Remote island known for rare alpine wildflowers. Ferry from Wakkanai.', null, null, null, null],
  // Tokyo / Kanto
  [TRIP_ID, 'Senso-ji Temple', 35.7148, 139.7967, '2-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan', 3, '07:00', 90, "Tokyo's oldest and most visited temple. Early morning visit avoids the crowds.", null, null, null, null],
  [TRIP_ID, 'Toyosu Manyo Club', 35.6478, 139.7759, '2-1-1 Toyosu, Koto City, Tokyo 135-0061, Japan', 6, '14:00', 180, 'Rooftop hot spring with views over Rainbow Bridge and Tokyo Bay.', null, null, null, null],
  [TRIP_ID, 'Eteco Bread', 35.7028, 139.6028, 'Nishiogikubo, Suginami City, Tokyo, Japan', 7, '09:00', 45, 'Artisan bakery with intricate bread sculptures inspired by anime and nature.', null, null, null, null],
  [TRIP_ID, 'Sagamiko Illumilion', 35.6150, 139.1550, 'Sagamiko, Sagamihara, Kanagawa, Japan', 6, '18:00', 90, "Dazzling lakeside illumination event — one of Japan's largest winter light shows.", null, null, null, null],
  [TRIP_ID, 'Nokogiriyama', 35.1167, 139.8333, 'Nokogiriyama, Kyonan, Awa District, Chiba, Japan', 9, '09:00', 180, 'Saw-tooth mountain with a giant Buddha and sweeping views of Tokyo Bay. Take the ropeway.', null, null, null, null],
  // Tochigi
  [TRIP_ID, 'Nakagawa-machi', 36.7492, 140.0253, 'Nakagawa-machi, Naka District, Tochigi, Japan', 9, '10:00', 120, 'Scenic town in Tochigi with seasonal flowers and traditional countryside scenery.', null, null, null, null],
  [TRIP_ID, 'Masao Higuchi Wisteria Garden', 36.2811, 139.5164, 'Tochigi, Japan', 9, '10:00', 90, 'Breathtaking private wisteria garden — a canopy of purple blooms in late April.', null, null, null, null],
  // Gunma
  [TRIP_ID, 'Kusatsu Onsen', 36.6203, 138.5969, 'Kusatsu, Agatsuma District, Gunma, Japan', 6, '15:00', 180, "One of Japan's premier hot spring resorts. The sulfurous Yubatake grass field is iconic.", null, null, null, null],
  [TRIP_ID, 'Onioshidashi Park', 36.5414, 138.6706, 'Kita-Asakamachi, Agatsuma District, Gunma, Japan', 9, '09:00', 90, 'Ancient lava field at the foot of Mt. Asama — eerie moonscape landscape amid wildflowers.', null, null, null, null],
  [TRIP_ID, 'Mizusawa Kannon', 36.4672, 138.8947, 'Ikaho, Kitagunma District, Gunma, Japan', 3, '09:00', 60, 'Hilltop Buddhist temple near Ikaho Onsen with fine mountain views and serene corridors.', null, null, null, null],
  [TRIP_ID, 'Shima Onsen', 36.7600, 138.7900, 'Nakanojo, Agatsuma District, Gunma, Japan', 6, '15:00', 180, "Secluded river valley onsen town — said to be one of the inspirations for Spirited Away.", null, null, null, null],
  [TRIP_ID, 'Onsen Sanso Daikon no Hana', 36.7650, 138.7950, 'Nakanojo, Agatsuma District, Gunma, Japan', 1, '16:00', 60, 'Rustic mountain inn near Shima Onsen with a cosy atmosphere and therapeutic open-air baths.', null, null, null, null],
  // Fukushima
  [TRIP_ID, 'Inawashiro Herb Garden', 37.5500, 140.0333, 'Inawashiro, Yama District, Fukushima, Japan', 9, '10:00', 90, 'Terraced herb and flower gardens on Mt. Bandai slopes with panoramic Lake Inawashiro views.', null, null, null, null],
  // Nagano
  [TRIP_ID, 'Kamikochi', 36.2398, 137.6428, 'Kamikochi, Matsumoto, Nagano, Japan', 9, '07:00', 360, 'Sacred alpine valley — Kappa Bridge, turquoise Azusa River, and the Northern Alps backdrop.', null, null, null, null],
  [TRIP_ID, 'Togakushi Shrine', 36.7833, 138.0667, 'Togakushi, Nagano City, Nagano, Japan', 3, '08:00', 120, 'Ancient mountain shrine reached via a 2km avenue of towering cedar trees.', null, null, null, null],
  [TRIP_ID, 'Narai-juku', 36.0059, 137.8678, 'Narai, Shiojiri, Nagano, Japan', 3, '11:00', 90, 'Best-preserved post town on the Nakasendo highway — feels frozen in the Edo period.', null, null, null, null],
  [TRIP_ID, 'Magome-juku', 35.5167, 137.5667, 'Magome, Nakatsugawa, Gifu, Japan', 3, '10:00', 90, 'Hillside post town and start of the scenic Nakasendo walk to Tsumago. Cobblestones and old inns.', null, null, null, null],
  // Gifu
  [TRIP_ID, 'Shirakawa-go', 36.2558, 136.9058, 'Ogimachi, Shirakawa, Ono District, Gifu, Japan', 3, '10:00', 150, 'UNESCO-listed gassho-zukuri farmhouses — snow-laden rooftops are iconic in winter.', null, null, null, null],
  [TRIP_ID, 'Hida Folk Village', 36.1503, 137.2504, '1-590 Kamiokamotocho, Takayama, Gifu, Japan', 3, '10:00', 120, 'Open-air museum of traditional thatched farmhouses moved from across the Hida region.', null, null, null, null],
  [TRIP_ID, 'Takayama Sanmachi Historic District', 36.1417, 137.2558, 'Sanmachi, Takayama, Gifu, Japan', 3, '09:00', 120, 'Beautifully preserved Edo merchant town — sake breweries, craft shops, and morning markets.', null, null, null, null],
  [TRIP_ID, 'Gero Onsen Onsenji', 35.8048, 137.2440, 'Gero, Gifu, Japan', 3, '08:00', 60, 'Hilltop temple above Gero Onsen with foot baths and panoramic views of the Hida River valley.', null, null, null, null],
  [TRIP_ID, 'Gero Onsen Yunoshimakan', 35.8067, 137.2444, 'Gero, Gifu, Japan', 1, '15:00', 60, "Historic riverside ryokan in one of Japan's three great onsen towns.", null, null, null, null],
  [TRIP_ID, "Monet's Pond", 35.7500, 136.7167, 'Akechi-cho, Ena, Gifu, Japan', 9, '09:00', 60, 'Spring-fed pond of astonishing clarity — plants and koi appear to float in mid-air like a Monet painting.', null, null, null, null],
  [TRIP_ID, 'Tsukechi Gorge', 35.6167, 137.4167, 'Tsukechi, Nakatsugawa, Gifu, Japan', 9, '10:00', 90, 'Lush emerald gorge with traditional suspension bridges and cool mist from the rapids below.', null, null, null, null],
  [TRIP_ID, 'Ryujin Falls', 35.5500, 137.0000, 'Gifu, Japan', 9, '09:00', 60, "Powerful hidden waterfall deep in Gifu's cedar forests — one of the prefecture's secret gems.", null, null, null, null],
  // Aichi
  [TRIP_ID, 'Kiyosu Castle', 35.1983, 136.8447, 'Kiyosu, Aichi, Japan', 3, '10:00', 60, "Elegantly white reconstructed castle that served as Oda Nobunaga's strategic base.", null, null, null, null],
  [TRIP_ID, 'Panel Café Nagoya Station', 35.1706, 136.8816, 'Nagoya Station area, Nagoya, Aichi, Japan', 7, '08:00', 60, "Kissaten-style café embodying Nagoya's famed morning culture — coffee comes with generous free toast.", null, null, null, null],
  [TRIP_ID, 'Sky Garden', 35.0522, 136.8834, 'Nagoya, Aichi, Japan', 9, '14:00', 90, 'Rooftop garden with panoramic views across Nagoya and Ise Bay.', null, null, null, null],
  [TRIP_ID, 'Chita Bamboo Forest', 34.9042, 136.8898, 'Chita Peninsula, Aichi, Japan', 9, '10:00', 60, 'Atmospheric bamboo grove on the Chita Peninsula — cool green light filters through the towering stalks.', null, null, null, null],
  // Fukui
  [TRIP_ID, 'Echizen Daibutsu', 35.9714, 136.1852, 'Echizen, Fukui, Japan', 3, '10:00', 60, "One of Japan's largest Great Buddha statues, set in a serene wooded hillside compound.", null, null, null, null],
  [TRIP_ID, 'Myotsu-ji', 35.5333, 135.9167, 'Obama, Fukui, Japan', 3, '09:00', 60, 'Ancient temple with a three-story pagoda framed by maples — spectacular in autumn colour.', null, null, null, null],
  // Shiga
  [TRIP_ID, 'Hyakusai-ji Temple', 35.2117, 136.3194, 'Higashiomi, Shiga, Japan', 3, '09:00', 90, 'Thousand-year-old temple on Mt. Kinugasa — famous for its ancient wisteria and brilliant autumn foliage.', null, null, null, null],
  [TRIP_ID, 'Konsho-ji Temple', 35.2300, 136.2600, 'Shiga, Japan', 3, '10:00', 60, 'Garden temple known for summer hydrangeas and fiery autumn maples along stone-paved paths.', null, null, null, null],
  [TRIP_ID, 'Sunken Torii of Benten Pond', 35.2833, 136.1583, 'Nagahama, Shiga, Japan', 3, '08:00', 60, 'Stone torii gate that appears to rise from a glassy pond — especially magical at dawn.', null, null, null, null],
  [TRIP_ID, 'Yokokuraji', 34.9700, 136.2900, 'Shiga, Japan', 3, '09:00', 60, 'Remote mountaintop temple with ancient stone-carved Buddhas and sweeping valley views.', null, null, null, null],
  // Kyoto
  [TRIP_ID, 'Byodo-in Temple', 34.8889, 135.8076, '116 Renge, Uji, Kyoto 611-0021, Japan', 3, '09:00', 90, 'UNESCO-listed Phoenix Hall reflected in its mirror pond — the temple on the 10-yen coin. Special autumn night viewing: Shoko shoan kanji no Akari.', null, null, null, null],
  [TRIP_ID, 'Kiyomizu-dera', 34.9949, 135.7851, '1-294 Kiyomizu, Higashiyama Ward, Kyoto, Japan', 3, '07:00', 90, 'Iconic hilltop temple with a wooden stage jutting over the valley. Misty views at dawn.', null, null, null, null],
  [TRIP_ID, 'Keishun-in Temple / Green Zen Garden', 35.0261, 135.7230, 'Myoshinji, Ukyo Ward, Kyoto, Japan', 3, '10:00', 60, 'Intimate Myoshinji sub-temple with a celebrated moss-and-stone zen garden.', null, null, null, null],
  [TRIP_ID, 'Joshoko-ji Temple', 35.0100, 135.7500, 'Kyoto, Japan', 3, '11:00', 60, 'Peaceful mountain temple near Kyoto with beautiful seasonal gardens.', null, null, null, null],
  [TRIP_ID, 'Sagenta Kifune', 35.1167, 135.7500, 'Kibune, Sakyo Ward, Kyoto, Japan', 2, '12:00', 120, 'Kawadoko river-platform dining in Kibune — tables built over a cool mountain stream, perfect in summer.', null, null, null, null],
  // Nara
  [TRIP_ID, 'Hasedera Temple', 34.5320, 135.9062, 'Hase, Sakurai, Nara, Japan', 3, '09:00', 90, 'Temple of peonies and wisteria on a misty hillside, with a long covered wooden stairway to the main hall.', null, null, null, null],
  [TRIP_ID, 'Hozan-ji Temple', 34.5942, 135.6706, 'Shigi, Heguri, Ikoma District, Nara, Japan', 3, '09:00', 60, 'Hilltop temple on Mt. Shigi with a tiger legend and panoramic views over the Yamato Plain.', null, null, null, null],
  [TRIP_ID, 'Tsubosaka-dera', 34.4572, 135.8250, 'Tsubosaka, Takatori, Takaichi District, Nara, Japan', 3, '10:00', 60, 'Temple dedicated to healing eyesight, with giant Indian-style stone carvings in the grounds.', null, null, null, null],
  // Osaka
  [TRIP_ID, 'Hello Donuts', 34.6937, 135.5023, 'Osaka, Japan', 7, '10:00', 30, 'Artisan donut shop with photogenic seasonal creations and beautiful presentation.', null, null, null, null],
  // Mie
  [TRIP_ID, 'Taki Shrine', 34.4833, 136.5833, 'Taki, Taki District, Mie, Japan', 3, '09:00', 60, 'Ancient shrine tucked into cedar forests of Mie, with a sacred waterfall nearby.', null, null, null, null],
  // Wakayama
  [TRIP_ID, 'Niutsuhime Shrine', 34.3267, 135.3597, 'Katsuragi, Ito District, Wakayama, Japan', 3, '10:00', 60, 'Head shrine of the deity who guided Kukai to Mount Koya — set in ancient cryptomeria forest.', null, null, null, null],
  [TRIP_ID, 'Mount Koya', 34.2126, 135.5886, 'Koya, Ito District, Wakayama, Japan', 3, '09:00', 360, "Sacred Shingon Buddhist mountain. Okunoin cemetery at dawn is one of Japan's most spiritual experiences. Stay overnight in a shukubo temple lodging.", null, null, null, null],
  [TRIP_ID, 'Kayasan', 34.2800, 135.6000, 'Wakayama, Japan', 9, '08:00', 180, 'Sacred mountain with ancient cedar forests, waterfalls, and deep Buddhist significance.', null, null, null, null],
  [TRIP_ID, 'Nachi Falls', 33.6617, 135.9894, 'Nachikatsuura, Higashimuro District, Wakayama, Japan', 9, '08:00', 90, "Japan's tallest waterfall at 133m. Part of the Kumano Kodo pilgrimage. Kumano Nachi Taisha shrine is adjacent.", null, null, null, null],
  [TRIP_ID, 'Ishiyama Temple', 34.2500, 135.2500, 'Wakayama, Japan', 3, '10:00', 60, 'Sacred temple where Lady Murasaki is said to have been inspired to write The Tale of Genji.', null, null, null, null],
  [TRIP_ID, 'Motojima Shrine', 33.8500, 135.4500, 'Wakayama, Japan', 3, '10:00', 60, 'Hidden mountain shrine deep in the Wakayama forests with a mystical, secluded atmosphere.', null, null, null, null],
  // Shimane / Tokushima
  [TRIP_ID, 'Iwami Ginzan', 35.1000, 132.4333, 'Omori, Oda, Shimane, Japan', 3, '10:00', 120, "UNESCO-listed silver mine — once provided a third of the world's silver. Quiet whitewashed historic lanes.", null, null, null, null],
  [TRIP_ID, 'Udatsu Wall Historical District', 34.0563, 134.1478, 'Mima, Tokushima, Japan', 3, '10:00', 90, 'Preserved Edo-era merchant town famous for its distinctive udatsu fire-break walls.', null, null, null, null],
  // Fukuoka
  [TRIP_ID, 'Amam Dacotan Ghibli Bakery', 33.5892, 130.3949, 'Fukuoka, Japan', 7, '09:00', 60, "One of Japan's most celebrated artisan bakeries — a visual feast of bread sculptures. Expect queues.", null, null, null, null],
  // Kumamoto
  [TRIP_ID, 'Kamishikimi Kumanoimasu Shrine', 32.9175, 130.8158, 'Yamato, Kamimashiki District, Kumamoto, Japan', 3, '09:00', 90, 'Mossy stone steps winding through ancient forest to a lantern-lined hilltop shrine.', null, null, null, null],
  [TRIP_ID, 'Kurokawa Onsen', 33.0378, 131.1563, 'Minami-Oguni, Aso District, Kumamoto, Japan', 6, '13:00', 240, "One of Japan's most beloved onsen villages. Buy a bath-pass and hop between riverside ryokan baths.", null, null, null, null],
  // Miyazaki
  [TRIP_ID, 'Amano Yasugawara', 32.6891, 131.2939, 'Takachiho, Nishiusuki District, Miyazaki, Japan', 3, '09:00', 60, 'River cave where the sun goddess hid — thousands of small stone piles line the mossy path.', null, null, null, null],
  [TRIP_ID, 'Takachiho Gorge', 32.7083, 131.3083, 'Takachiho, Nishiusuki District, Miyazaki, Japan', 9, '08:00', 120, 'Spectacular V-shaped basalt gorge. Hire a rowboat to glide under the Manai Falls.', null, null, null, null],
  [TRIP_ID, 'Udo Jingu', 31.5667, 131.4167, 'Nichinan, Miyazaki, Japan', 3, '09:00', 60, 'Dramatic shrine built into a sea cave on the Pacific coast. Throw clay balls into a hollow rock for luck.', null, null, null, null],
  // Kagoshima
  [TRIP_ID, 'Kirishima Jingu', 31.9267, 130.8644, 'Kirishima, Kagoshima, Japan', 3, '09:00', 90, 'Ancient Shinto shrine at the foot of volcanic Mt. Kirishima — vivid crimson torii gates amid cedar forest.', null, null, null, null],
  // Okinawa
  [TRIP_ID, 'Fukushuen Garden', 26.2167, 127.6833, 'Naha, Okinawa, Japan', 9, '10:00', 90, 'Chinese-style garden celebrating the historic ties between Naha and Fuzhou, with pavilions and koi ponds.', null, null, null, null],
  [TRIP_ID, 'Sosu Beach', 26.1500, 127.6500, 'Okinawa, Japan', 8, '11:00', 180, "Crystal-clear turquoise waters on one of Okinawa's unspoiled sandy beaches.", null, null, null, null],
];

// ── Insert places ────────────────────────────────────────────────────────────
const insertPlace = db.prepare(
  'INSERT INTO places (trip_id, name, lat, lng, address, category_id, place_time, duration_minutes, notes, image_url, google_place_id, website, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const insertAssignment = db.prepare('INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, ?)');

const pIds: number[] = [];
const seed = db.transaction(() => {
  for (const p of places) {
    const r = insertPlace.run(...p);
    pIds.push(Number(r.lastInsertRowid));
  }

  // Assignments: 30 days, 64 places distributed as designed
  const A = (dayIdx: number, placeIdx: number, order: number) =>
    insertAssignment.run(dayIds[dayIdx], pIds[placeIdx], order);

  // Day 1: Shikisai-no-oka, Rebun Island
  A(0,0,0); A(0,1,1);
  // Day 2: Senso-ji, Toyosu Manyo Club
  A(1,2,0); A(1,3,1);
  // Day 3: Eteco Bread, Sagamiko Illumilion
  A(2,4,0); A(2,5,1);
  // Day 4: Nokogiriyama
  A(3,6,0);
  // Day 5: Nakagawa-machi, Masao Higuchi Wisteria Garden
  A(4,7,0); A(4,8,1);
  // Day 6: Kusatsu Onsen, Onioshidashi Park
  A(5,9,0); A(5,10,1);
  // Day 7: Mizusawa Kannon, Shima Onsen, Onsen Sanso Daikon no Hana
  A(6,11,0); A(6,12,1); A(6,13,2);
  // Day 8: Inawashiro Herb Garden
  A(7,14,0);
  // Day 9: Kamikochi, Togakushi Shrine
  A(8,15,0); A(8,16,1);
  // Day 10: Narai-juku, Magome-juku
  A(9,17,0); A(9,18,1);
  // Day 11: Shirakawa-go, Hida Folk Village
  A(10,19,0); A(10,20,1);
  // Day 12: Takayama Sanmachi, Gero Onsen Onsenji, Gero Onsen Yunoshimakan
  A(11,21,0); A(11,22,1); A(11,23,2);
  // Day 13: Monet's Pond, Tsukechi Gorge, Ryujin Falls
  A(12,24,0); A(12,25,1); A(12,26,2);
  // Day 14: Kiyosu Castle, Panel Café Nagoya Station, Sky Garden
  A(13,27,0); A(13,28,1); A(13,29,2);
  // Day 15: Chita Bamboo Forest
  A(14,30,0);
  // Day 16: Echizen Daibutsu, Myotsu-ji
  A(15,31,0); A(15,32,1);
  // Day 17: Hyakusai-ji Temple, Konsho-ji Temple, Sunken Torii of Benten Pond
  A(16,33,0); A(16,34,1); A(16,35,2);
  // Day 18: Yokokuraji, Byodo-in Temple
  A(17,36,0); A(17,37,1);
  // Day 19: Kiyomizu-dera, Keishun-in Temple, Joshoko-ji Temple
  A(18,38,0); A(18,39,1); A(18,40,2);
  // Day 20: Sagenta Kifune
  A(19,41,0);
  // Day 21: Hasedera Temple, Hozan-ji Temple, Tsubosaka-dera
  A(20,42,0); A(20,43,1); A(20,44,2);
  // Day 22: Hello Donuts, Taki Shrine
  A(21,45,0); A(21,46,1);
  // Day 23: Niutsuhime Shrine, Mount Koya, Kayasan
  A(22,47,0); A(22,48,1); A(22,49,2);
  // Day 24: Nachi Falls, Ishiyama Temple, Motojima Shrine
  A(23,50,0); A(23,51,1); A(23,52,2);
  // Day 25: Iwami Ginzan, Udatsu Wall Historical District
  A(24,53,0); A(24,54,1);
  // Day 26: Amam Dacotan Ghibli Bakery
  A(25,55,0);
  // Day 27: Kamishikimi Kumanoimasu Shrine, Kurokawa Onsen
  A(26,56,0); A(26,57,1);
  // Day 28: Amano Yasugawara, Takachiho Gorge, Udo Jingu
  A(27,58,0); A(27,59,1); A(27,60,2);
  // Day 29: Kirishima Jingu
  A(28,61,0);
  // Day 30: Fukushuen Garden, Sosu Beach
  A(29,62,0); A(29,63,1);
});

seed();
console.log(`Done! Inserted ${pIds.length} places into trip "${trip.title}".`);
db.close();
