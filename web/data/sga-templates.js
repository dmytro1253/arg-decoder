// Шаблоны глифов «Стандартного галактического алфавита» Minecraft (шрифт ascii_sga, сетка 7 строк).
// Растры сняты с двух реальных скриншотов (verified: true — глиф реально встретился на фото).
// Глифы с verified: false не встречались в образцах: нарисованы вручную по шрифту игры, могут
// отличаться в вашей версии Minecraft. Знаки препинания (, . ; [ `) в игре рисует обычный шрифт —
// они тоже в списке. lead — сколько лишних пустых столбцов обычно стоит перед глифом
// (у «c» 2, у «`» 1): без этого они принимаются за пробел между словами.
(function (G) {
  'use strict';
  G.SgaTemplates = {
    rows: 7,
    wordGap: 4,
    templates: [
      {"ch": "t", "rows": ["#####", "....#", "....#", "....#", "....#", ".....", "....#"], "lead": 0, "source": "sample", "seen": 11, "verified": true},
      {"ch": "f", "rows": ["#####", ".....", "#.#.#", ".....", ".....", ".....", "....."], "lead": 0, "source": "sample", "seen": 11, "verified": true},
      {"ch": "j", "rows": ["#", "#", ".", "#", ".", "#", "#"], "lead": 0, "source": "sample", "seen": 10, "verified": true},
      {"ch": "n", "rows": [".#.#", ".#.#", "...#", "..#.", "..#.", ".#..", "#..."], "lead": 0, "source": "sample", "seen": 10, "verified": true},
      {"ch": "b", "rows": ["..#..", "..#..", "..#..", "..#..", "...#.", "....#", "#####"], "lead": 0, "source": "sample", "seen": 8, "verified": true},
      {"ch": "y", "rows": ["#.#", "#.#", "#.#", "#.#", "#.#", "#.#", "#.#"], "lead": 0, "source": "sample", "seen": 8, "verified": true},
      {"ch": "c", "rows": ["#.", "..", "#.", "#.", "##", ".#", ".#"], "lead": 2, "source": "sample", "seen": 7, "verified": true},
      {"ch": "e", "rows": ["#...#", "#....", "#....", "#....", "#....", "#....", "#####"], "lead": 0, "source": "sample", "seen": 7, "verified": true},
      {"ch": "r", "rows": ["#...#", ".....", ".....", ".....", ".....", ".....", "#...#"], "lead": 0, "source": "sample", "seen": 6, "verified": true},
      {"ch": "h", "rows": ["#####", ".....", "#####", "..#..", "..#..", "..#..", "..#.."], "lead": 0, "source": "sample", "seen": 6, "verified": true},
      {"ch": "d", "rows": ["#####", ".....", "##...", "..#..", "...##", ".....", "....."], "lead": 0, "source": "sample", "seen": 6, "verified": true},
      {"ch": "l", "rows": ["#..", "#.#", "#..", "#..", "#..", "#.#", "#.."], "lead": 0, "source": "sample", "seen": 5, "verified": true},
      {"ch": "m", "rows": ["#...#", "....#", "....#", "....#", "....#", "....#", "#####"], "lead": 0, "source": "sample", "seen": 4, "verified": true},
      {"ch": "k", "rows": ["..#..", "..#..", "..#..", "#.#.#", "..#..", "..#..", "..#.."], "lead": 0, "source": "sample", "seen": 4, "verified": true},
      {"ch": "v", "rows": ["..#..", "..#..", "..#..", "..#..", "#####", ".....", "#####"], "lead": 0, "source": "sample", "seen": 4, "verified": true},
      {"ch": "x", "rows": ["#...#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."], "lead": 0, "source": "sample", "seen": 4, "verified": true},
      {"ch": "i", "rows": ["#", "#", "#", ".", "#", "#", "#"], "lead": 0, "source": "sample", "seen": 3, "verified": true},
      {"ch": "p", "rows": ["#.#", "..#", "#.#", "#.#", "#.#", "#..", "#.#"], "lead": 0, "source": "sample", "seen": 3, "verified": true},
      {"ch": ",", "rows": [".", ".", ".", ".", ".", "#", "#"], "lead": 0, "source": "sample", "seen": 3, "verified": true},
      {"ch": "g", "rows": ["..#", "..#", "..#", "###", "..#", "..#", "..#"], "lead": 0, "source": "sample", "seen": 2, "verified": true},
      {"ch": "z", "rows": ["..#..", ".#.#.", "#...#", "#...#", "#...#", "#...#", "#...#"], "lead": 0, "source": "sample", "seen": 2, "verified": true},
      {"ch": "w", "rows": [".....", ".....", "..#..", ".....", ".....", "#...#", "....."], "lead": 0, "source": "sample", "seen": 2, "verified": true},
      {"ch": "s", "rows": ["#.", "#.", "#.", "##", ".#", ".#", ".#"], "lead": 0, "source": "sample", "seen": 2, "verified": true},
      {"ch": "[", "rows": ["##", "#.", "#.", "#.", "#.", "#.", "##"], "lead": 0, "source": "sample", "seen": 1, "verified": true},
      {"ch": "a", "rows": ["..##.", ".#..#", ".#...", ".#...", ".#...", ".#...", "##..."], "lead": 0, "source": "sample", "seen": 1, "verified": true},
      {"ch": "`", "rows": ["#.", ".#", "..", "..", "..", "..", ".."], "lead": 1, "source": "sample", "seen": 1, "verified": true},
      {"ch": "q", "rows": ["..#..", ".....", "#####", "....#", "....#", "....#", "#####"], "lead": 0, "source": "sample", "seen": 1, "verified": true},
      {"ch": ";", "rows": [".", ".", "#", ".", ".", "#", "#"], "lead": 0, "source": "sample", "seen": 1, "verified": true},
      {"ch": ".", "rows": [".", ".", ".", ".", ".", ".", "#"], "lead": 0, "source": "sample", "seen": 1, "verified": true},
      {"ch": "n", "rows": ["#..#", "#..#", "...#", "..#.", "..#.", ".#..", "#..."], "lead": 0, "source": "game-font 1.21 variant (same letter, different version)", "seen": 0, "verified": false},
      {"ch": "r", "rows": ["#..#.", ".....", ".....", ".....", ".....", ".....", "#..#."], "lead": 0, "source": "game-font 1.21 variant", "seen": 0, "verified": false},
      {"ch": "o", "rows": ["####.", "...#.", "...#.", "..#..", "..#..", ".#...", "#...."], "lead": 0, "source": "hand-drawn after game font", "seen": 0, "verified": false},
      {"ch": "u", "rows": [".....", ".....", ".#.#.", ".....", "#####", ".....", "....."], "lead": 0, "source": "hand-drawn after game font", "seen": 0, "verified": false},
      {"ch": "]", "rows": ["##", ".#", ".#", ".#", ".#", ".#", "##"], "lead": 0, "source": "mirror of \"[\"", "seen": 0, "verified": false},
      {"ch": "'", "rows": ["#", "#", "#", ".", ".", ".", "."], "lead": 0, "source": "hand-drawn", "seen": 0, "verified": false},
      {"ch": ":", "rows": [".", ".", "#", ".", ".", "#", "."], "lead": 0, "source": "hand-drawn", "seen": 0, "verified": false},
      {"ch": "!", "rows": ["#", "#", "#", "#", "#", ".", "#"], "lead": 0, "source": "hand-drawn", "seen": 0, "verified": false},
    ],
  };
})(typeof self !== 'undefined' ? self : this);
