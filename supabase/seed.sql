-- ============================================================
-- Boiska Poznań — Seed Data
-- Run this after 001_initial_schema.sql
-- ============================================================

-- 5 real-ish Poznań sports fields with approximate coordinates

INSERT INTO fields (id, name, address, lat, lng, sport, available, surface, is_indoor, phone, website, source)
VALUES
    (
        'b1a2c3d4-0001-0001-0001-000000000001',
        'Boisko Sportowe ul. Dąbrowskiego',
        'ul. Józefa Dąbrowskiego 79A, 60-101 Poznań',
        52.4234,
        16.9012,
        ARRAY['piłka nożna', 'futsal'],
        true,
        'artificial',
        false,
        '+48 61 868 55 00',
        NULL,
        'manual'
    ),
    (
        'b1a2c3d4-0002-0002-0002-000000000002',
        'Hala Arena Poznań — Sale Boczne',
        'ul. Wyspiańskiego 33, 60-750 Poznań',
        52.3932,
        16.9271,
        ARRAY['koszykówka', 'siatkówka', 'futsal'],
        true,
        'hardcourt',
        true,
        '+48 61 833 20 00',
        'https://www.arena.poznan.pl',
        'manual'
    ),
    (
        'b1a2c3d4-0003-0003-0003-000000000003',
        'Korty Tenisowe Olimpia',
        'ul. Warmińska 1, 61-613 Poznań',
        52.4512,
        16.9445,
        ARRAY['tenis'],
        true,
        'clay',
        false,
        '+48 61 822 49 80',
        NULL,
        'manual'
    ),
    (
        'b1a2c3d4-0004-0004-0004-000000000004',
        'Boisko Wielofunkcyjne Malta',
        'ul. Jana Pawła II 3, 61-139 Poznań',
        52.4068,
        16.9780,
        ARRAY['piłka nożna', 'koszykówka', 'siatkówka'],
        true,
        'concrete',
        false,
        NULL,
        'https://www.maltaski.pl',
        'manual'
    ),
    (
        'b1a2c3d4-0005-0005-0005-000000000005',
        'Hala Widowiskowo-Sportowa UAM',
        'ul. Wieniawskiego 1, 61-712 Poznań',
        52.4088,
        16.9155,
        ARRAY['koszykówka', 'siatkówka', 'piłka nożna'],
        false,
        'hardcourt',
        true,
        '+48 61 829 22 00',
        'https://amu.edu.pl',
        'manual'
    )
ON CONFLICT (id) DO NOTHING;

-- Sample game announcements
INSERT INTO games (id, field_id, sport, game_date, game_time, players_needed, players_joined, author_name, description)
VALUES
    (
        'a0000000-0001-0001-0001-000000000001',
        'b1a2c3d4-0001-0001-0001-000000000001',
        'piłka nożna',
        CURRENT_DATE + INTERVAL '3 days',
        '18:00',
        10,
        7,
        'Marek K.',
        'Gramy 5v5 na małym boisku. Poziom amatorski, dobra zabawa!'
    ),
    (
        'a0000000-0002-0002-0002-000000000002',
        'b1a2c3d4-0002-0002-0002-000000000002',
        'koszykówka',
        CURRENT_DATE + INTERVAL '4 days',
        '19:30',
        8,
        5,
        'Anna W.',
        'Cotygodniowa gra 4v4 w poniedziałki. Mile widziani gracze każdego poziomu.'
    )
ON CONFLICT (id) DO NOTHING;
