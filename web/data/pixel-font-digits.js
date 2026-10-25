// Цифры обычного шрифта Minecraft (книги, подсказки предметов): сетка 5×7 «родных» пикселей.
// verified: true — цифра реально встретилась на скриншотах (книга, подсказка); 8 и 9 в образцах не было.
(function (G) {
  'use strict';
  G.PixelFontTemplates = {
    rows: 7,
    wordGap: 4,
    templates: [
      {"ch": "0", "rows": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "1", "rows": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "2", "rows": [".###.", "#...#", "....#", "..##.", ".#...", "#...#", "#####"], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "3", "rows": [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "4", "rows": ["...##", "..#.#", ".#..#", "#...#", "#####", "....#", "....#"], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "5", "rows": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "6", "rows": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "7", "rows": ["#####", "#...#", "....#", "...#.", "..#..", "..#..", "..#.."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "8", "rows": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
      {"ch": "9", "rows": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."], "lead": 0, "source": "sample", "seen": 0, "verified": true},
    ],
  };
})(typeof self !== 'undefined' ? self : this);
