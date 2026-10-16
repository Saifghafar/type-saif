/* Type Saif — 02-data.js
 * Curriculum data module.
 * Registers on the global namespace as TS.data (window.TypeSaif).
 * Plain vanilla JS, classic script — no modules, no dependencies.
 * Loads after 00-utils.js and 01-storage.js; uses nothing but its own code.
 */
(function () {
  "use strict";

  (window.TypeSaif = window.TypeSaif || {});
  var TS = window.TypeSaif;

  /* ------------------------------------------------------------------ */
  /* CURRICULUM — 10 levels, each {n, title, desc, lessons:[...]}.        */
  /* Lesson: {id, level, title, desc, instructions, text, focus,         */
  /*          fingers}. Text bands: L1-L4 60-160 chars, L5-L7 100-250,    */
  /* L8-L10 200-450. fingers=true for L1-L4 only.                         */
  /* ------------------------------------------------------------------ */
  var CURRICULUM = [
    {
      n: 1,
      title: "Keyboard Foundations",
      desc: "Learn the home row, good posture, and the F and J guide bumps.",
      lessons: [
        {
          id: "L1-1",
          level: 1,
          title: "Meet the Home Row",
          desc: "Place your fingers on the home row and feel the bumps on F and J.",
          instructions: "Rest your left fingers on A S D F and your right fingers on J K L ;. Find the small bumps on F and J without looking.",
          text: "aaa sss ddd fff jjj kkk lll ;;; aaa sss ddd fff jjj kkk lll ;;; aaa sss ddd fff jjj kkk lll ;;;",
          focus: "asdfjkl;",
          fingers: true
        },
        {
          id: "L1-2",
          level: 1,
          title: "Left Hand, Right Hand",
          desc: "Type smooth left-hand and right-hand groups on the home row.",
          instructions: "Keep your wrists straight and tap each key lightly. Type the left-hand group, then the right-hand group.",
          text: "asdf asdf asdf jkl; jkl; jkl; asdf jkl; asdf jkl; asdf jkl; asdf jkl;",
          focus: "asdfjkl;",
          fingers: true
        },
        {
          id: "L1-3",
          level: 1,
          title: "Fingers Find Home",
          desc: "Alternate your fingers to build control on the home row.",
          instructions: "Type each letter pair slowly. Return your fingers to the bumps on F and J after every few keys.",
          text: "a ; s l d k f j a ; s l d k f j a ; s l d k f j a ; s l d k f j",
          focus: "asdfjkl;",
          fingers: true
        },
        {
          id: "L1-4",
          level: 1,
          title: "Home Row Flow",
          desc: "Link home-row keys into smooth, flowing sequences.",
          instructions: "Type at a steady rhythm without rushing. Accuracy first — speed will follow.",
          text: "adf ;lk ajs; dflk ;lsa asdf jkl; adf ;lk ajs; dflk ;lsa asdf jkl;",
          focus: "asdfjkl;",
          fingers: true
        }
      ]
    },
    {
      n: 2,
      title: "Home-Row Practice",
      desc: "Build home-row control with single keys, alternating hands, and simple words.",
      lessons: [
        {
          id: "L2-1",
          level: 2,
          title: "Left Hand Words",
          desc: "Type simple words using only your left hand.",
          instructions: "Keep your left fingers on A S D F. These short words use only left-hand home-row keys.",
          text: "sad lad fad dad had sad lad fad dad had sad lad fad dad had sad lad fad dad had",
          focus: "sadfld",
          fingers: true
        },
        {
          id: "L2-2",
          level: 2,
          title: "Right Hand Words",
          desc: "Type simple words using only your right hand.",
          instructions: "Keep your right fingers on J K L ;. These words use only right-hand home-row keys.",
          text: "ask all fall lass hall shall ask all fall lass hall shall ask all fall lass hall shall",
          focus: "askl;h",
          fingers: true
        },
        {
          id: "L2-3",
          level: 2,
          title: "Both Hands Together",
          desc: "Alternate hands to type smooth home-row words.",
          instructions: "Let your hands take turns. Feel how alternating hands makes typing faster and easier.",
          text: "as sad lad asks all lass fall as sad lad asks all lass fall as sad lad asks all lass fall",
          focus: "asdfjkl;",
          fingers: true
        },
        {
          id: "L2-4",
          level: 2,
          title: "Home Row Sentences",
          desc: "Link home-row words into tiny sentences.",
          instructions: "Type each small sentence smoothly. Keep your eyes on the screen, not on your hands.",
          text: "a sad lad had a fall as all lads ask dad a sad lad had a fall as all lads ask dad",
          focus: "asdfjkl;",
          fingers: true
        }
      ]
    },
    {
      n: 3,
      title: "Upper Row",
      desc: "Reach up to the top letter row and blend it with the home row.",
      lessons: [
        {
          id: "L3-1",
          level: 3,
          title: "Top Row Left: Q W E R T",
          desc: "Reach up to Q W E R T with the correct fingers.",
          instructions: "Stretch your left fingers up one row, then curl back home. Keep the other fingers resting on the home row.",
          text: "qqq www eee rrr ttt qwe qwe qwe qqq www eee rrr ttt qwe qwe qwe",
          focus: "qwert",
          fingers: true
        },
        {
          id: "L3-2",
          level: 3,
          title: "Top Row Right: Y U I O P",
          desc: "Reach up to Y U I O P with the correct fingers.",
          instructions: "Stretch your right fingers up one row, then curl back home. Use the F bump as your guide back.",
          text: "yyy uuu iii ooo ppp yui yui yui yyy uuu iii ooo ppp yui yui yui",
          focus: "yuiop",
          fingers: true
        },
        {
          id: "L3-3",
          level: 3,
          title: "Top Row Words",
          desc: "Type real words using the top row and home row.",
          instructions: "Mix top-row reaches with home-row keys. Type slowly and let your fingers learn each reach.",
          text: "we wet were tree type quite quiet pretty we wet were tree type quite quiet pretty",
          focus: "qwertyuiop",
          fingers: true
        },
        {
          id: "L3-4",
          level: 3,
          title: "Two Rows Combined",
          desc: "Blend top-row and home-row words in one drill.",
          instructions: "Switch between rows without looking down. Trust the F and J bumps to guide you home.",
          text: "red tear water later quiet sad lad red tear water later quiet sad lad",
          focus: "qwertyuiopasdfjkl;",
          fingers: true
        }
      ]
    },
    {
      n: 4,
      title: "Lower Row",
      desc: "Reach down to the bottom letter row and combine all three rows.",
      lessons: [
        {
          id: "L4-1",
          level: 4,
          title: "Bottom Row Left: Z X C V B",
          desc: "Reach down to Z X C V B with the correct fingers.",
          instructions: "Drop your left fingers down one row, then curl back home. Keep your wrists still and move only your fingers.",
          text: "zzz xxx ccc vvv bbb zxc zxc zxc zzz xxx ccc vvv bbb zxc zxc zxc",
          focus: "zxcvb",
          fingers: true
        },
        {
          id: "L4-2",
          level: 4,
          title: "Bottom Row Right: N M , . /",
          desc: "Reach down to N M and the comma, period, and slash keys.",
          instructions: "Your right index finds N, middle finds M, ring finds the comma. Stretch down, then return home.",
          text: "nnn mmm ,,, ... /// n m , . / nnn mmm ,,, ... /// n m , . / n m , . /",
          focus: "nm,./",
          fingers: true
        },
        {
          id: "L4-3",
          level: 4,
          title: "Bottom Row Words",
          desc: "Type words that use the bottom row.",
          instructions: "These words mix the bottom row with keys you already know. Reach down and come straight back.",
          text: "van can box fox mix six cob web van can box fox mix six cob web",
          focus: "zxcvbnm",
          fingers: true
        },
        {
          id: "L4-4",
          level: 4,
          title: "All Rows Together",
          desc: "Use every row of the keyboard in one flowing drill.",
          instructions: "You now know all the letter keys. Type this drill smoothly and feel your fingers travel across the whole keyboard.",
          text: "the quick red fox had a sad lad we can box van the quick red fox had a sad lad we can box van",
          focus: "all letters",
          fingers: true
        }
      ]
    },
    {
      n: 5,
      title: "Common Words",
      desc: "Type the most frequent English words until they feel automatic.",
      lessons: [
        {
          id: "L5-1",
          level: 5,
          title: "Everyday Short Words",
          desc: "The most common short words in English.",
          instructions: "These tiny words appear everywhere. Type them until they feel automatic.",
          text: "the and for are but not you all can had her was one our out day get has him his how man new now old see two way who boy did its let put say she too use",
          focus: "common words",
          fingers: false
        },
        {
          id: "L5-2",
          level: 5,
          title: "Common Letter Combos",
          desc: "Words built from the trickiest letter pairs.",
          instructions: "Watch for th, ch, sh, and wh. These pairs are the secret to fast English typing.",
          text: "the that this with they them then there when where which while should could would think thing much such each than",
          focus: "th ch sh wh",
          fingers: false
        },
        {
          id: "L5-3",
          level: 5,
          title: "Longer Common Words",
          desc: "Everyday words with five or more letters.",
          instructions: "Longer words need a steady rhythm. Type each one fully before moving to the next.",
          text: "about after again because before between every first found great house large learn little money never other place right small sound still study their there these thing think three water where which world would write",
          focus: "longer words",
          fingers: false
        },
        {
          id: "L5-4",
          level: 5,
          title: "Word Flow",
          desc: "Chain common words into a smooth stream.",
          instructions: "Type these word chains without pausing between words. Keep a light, even rhythm.",
          text: "you can do it we are here they will come she has time he made it we need more this is good that was fun you can do it we are here they will come she has time",
          focus: "word flow",
          fingers: false
        }
      ]
    },
    {
      n: 6,
      title: "Sentences",
      desc: "Master capitals, Shift, spaces, and basic sentence punctuation.",
      lessons: [
        {
          id: "L6-1",
          level: 6,
          title: "Capitals with Shift",
          desc: "Hold Shift to type capital letters.",
          instructions: "Hold Shift with the opposite hand from the letter key. Release Shift right after the capital.",
          text: "The sun is hot. We run and play. Sam sat on the mat. The dog ran fast. My cat naps all day. The red van is new.",
          focus: "shift capitals",
          fingers: false
        },
        {
          id: "L6-2",
          level: 6,
          title: "Commas and Periods",
          desc: "Add commas and periods to your sentences.",
          instructions: "Pause slightly at each comma. A period ends the sentence — then start fresh.",
          text: "I like apples, bananas, and grapes. On Monday, we went to the park. My bag has pens, books, and maps. The cat, the dog, and the bird sat still.",
          focus: ", .",
          fingers: false
        },
        {
          id: "L6-3",
          level: 6,
          title: "Asking Questions",
          desc: "Type questions with the question mark.",
          instructions: "Shift plus the slash key makes a question mark. Read each question as you type it.",
          text: "What is your name? Where do you live? Can you swim fast? Do you like cake? When is the party? How old are you now?",
          focus: "? shift",
          fingers: false
        },
        {
          id: "L6-4",
          level: 6,
          title: "Mixed Sentences",
          desc: "Combine capitals, commas, periods, and questions.",
          instructions: "This drill mixes everything you have learned. Take your time and stay accurate.",
          text: "Hello! My name is Sam. I live in a small town near the lake. Do you like to read books? I read every day after lunch. It is fun, and I learn a lot.",
          focus: "mixed punctuation",
          fingers: false
        }
      ]
    },
    {
      n: 7,
      title: "Numbers and Symbols",
      desc: "Type numbers, common symbols, dates, and times with confidence.",
      lessons: [
        {
          id: "L7-1",
          level: 7,
          title: "Number Row Basics",
          desc: "Find the number keys on the top row.",
          instructions: "Reach up from the home row to tap each number. Keep your other fingers resting at home.",
          text: "123 456 789 0 123 456 789 0 135 246 789 135 246 789 123 321 456 654 789 987 147 258 369 123 456 789 0 321",
          focus: "1234567890",
          fingers: false
        },
        {
          id: "L7-2",
          level: 7,
          title: "Common Symbols",
          desc: "Type the symbols you use every day.",
          instructions: "Hold Shift and reach to the number row for each symbol. Say the symbol name as you type it.",
          text: "a1! b2@ c3# d4$ e5% f6^ g7& h8* i9( j0) a1! b2@ c3# d4$ e5% f6^ g7& h8* i9( j0) a1! b2@ c3# d4$ e5% f6^",
          focus: "!@#$%^&*()",
          fingers: false
        },
        {
          id: "L7-3",
          level: 7,
          title: "Dates and Times",
          desc: "Type dates, times, and phone numbers.",
          instructions: "Numbers and symbols mix in real life. Type dates and times exactly as shown.",
          text: "My birthday is 12/05/2010. Class starts at 9:30 AM. The year 2026 has begun. Meet me at 4:45 PM on 03/21. Call 555-0142 after 6:00 PM.",
          focus: "dates times",
          fingers: false
        },
        {
          id: "L7-4",
          level: 7,
          title: "Numbers in Sentences",
          desc: "Blend numbers naturally into sentences.",
          instructions: "Switch between words and numbers smoothly. This is how numbers appear in real typing.",
          text: "I have 2 dogs and 3 cats. There are 24 kids in class 5B. The box holds 100 pens. We ran 5 km in 30 minutes. Room 12 costs $45 per night.",
          focus: "mixed numbers",
          fingers: false
        }
      ]
    },
    {
      n: 8,
      title: "Paragraphs and Fluency",
      desc: "Build fluency with full sentences and short paragraphs.",
      lessons: [
        {
          id: "L8-1",
          level: 8,
          title: "A Calm Morning",
          desc: "A gentle paragraph about the start of the day.",
          instructions: "Read ahead a little as you type. Keep a calm, even pace through the whole paragraph.",
          text: "Morning light fills the small kitchen. Sam pours a glass of milk and sits by the window. Birds sing in the tall tree outside. The day feels fresh and full of promise. After breakfast, Sam walks to work along the quiet street, humming a happy tune.",
          focus: "fluency",
          fingers: false
        },
        {
          id: "L8-2",
          level: 8,
          title: "The Small Garden",
          desc: "A paragraph about growing flowers.",
          instructions: "Type in a smooth rhythm, like telling a story out loud. Do not stop to fix small slips.",
          text: "Behind the house there is a small garden. Red roses grow beside the old stone wall, and bees visit every flower. In spring, Mia plants seeds in neat rows. She waters them each evening and watches them grow. By summer, the garden is full of color and sweet smells.",
          focus: "fluency",
          fingers: false
        },
        {
          id: "L8-3",
          level: 8,
          title: "Reading Every Day",
          desc: "A paragraph about a nightly reading habit.",
          instructions: "Aim for steady flow over raw speed. Smooth typing with few errors beats fast, messy typing.",
          text: "Ali loves to read before bed. Each night he picks a new book from the shelf and reads for one hour. Some nights the story is funny, and some nights it is full of adventure. Reading has taught him many new words. He dreams of writing his own book one day.",
          focus: "fluency",
          fingers: false
        }
      ]
    },
    {
      n: 9,
      title: "Speed Training",
      desc: "Push your speed with timed-style drills and common patterns.",
      lessons: [
        {
          id: "L9-1",
          level: 9,
          title: "Fast Common Words",
          desc: "A stream of the most frequent words for speed.",
          instructions: "Type as fast as you can while staying readable. These are the words your fingers should know by heart.",
          text: "the of and to in is you that it he was for on are as with his they at be this have from or one had by but not what all were we when can said there use each which she do how their will up other about out many then them these so some her would make like him into time has look two more write go see could my than first been call who now find",
          focus: "speed words",
          fingers: false
        },
        {
          id: "L9-2",
          level: 9,
          title: "Pattern Drills",
          desc: "Repeat common English word patterns at speed.",
          instructions: "Feel the -ing and -tion rhythms. Patterns let your fingers type whole chunks at once.",
          text: "running jumping singing dancing thinking reading writing playing going doing seeing making taking coming looking working talking walking baking cooking running jumping singing action nation station motion option question nation station motion option running thinking reading",
          focus: "ing tion patterns",
          fingers: false
        },
        {
          id: "L9-3",
          level: 9,
          title: "Rhythm Builder",
          desc: "Short sentences with a steady, even beat.",
          instructions: "Keep every keystroke evenly spaced, like a drumbeat. Speed comes from rhythm, not force.",
          text: "The quick cat ran up the hill. The big dog sat by the door. A red bird sang in the tree. The old man read the news. The young girl played a song. The warm sun made them smile. The cool wind felt so good. The small boat crossed the lake. The tall tree gave them shade. The green field looked so wide.",
          focus: "rhythm",
          fingers: false
        }
      ]
    },
    {
      n: 10,
      title: "Advanced Challenges",
      desc: "Longer passages with mixed punctuation, numbers, and tricky combos.",
      lessons: [
        {
          id: "L10-1",
          level: 10,
          title: "The Busy Market",
          desc: "A lively passage with prices and lists.",
          instructions: "Prices, colons, and commas mix here. Slow down for the symbols, then flow through the words.",
          text: "On Saturday morning, the market is full of life. Vendors call out prices: fresh apples $2, sweet oranges $3, and ripe bananas $1. Shoppers move between stalls, tasting samples and filling their bags. A baker sells warm bread for $4 a loaf. Near the corner, a flower seller offers red roses, 5 for $10. The air smells of coffee, spice, and rain.",
          focus: "mixed punctuation",
          fingers: false
        },
        {
          id: "L10-2",
          level: 10,
          title: "A Letter to a Friend",
          desc: "A friendly letter with dates and numbers.",
          instructions: "Letters mix everything: capitals, dates, numbers, and questions. Type it like you are writing to a real friend.",
          text: "Dear Ana, I hope you are well! It has been 3 months since we last met. My new job starts on 06/01, and I am both nervous and excited. The office is at 42 Park Lane, just 20 minutes from home. Last week I bought 2 plants for my desk. Write back soon and tell me your news. Do you still play tennis on Sundays? Your friend, Sam.",
          focus: "mixed everything",
          fingers: false
        },
        {
          id: "L10-3",
          level: 10,
          title: "Master Drill",
          desc: "The trickiest words and pangrams in one drill.",
          instructions: "This is the final test. Stay loose, keep your eyes up, and let your fingers do the work.",
          text: "The sixth sick sheikh's sixth sheep is sick. She sells seashells by the seashore. Three free throws flew through the thick fog. Quick quiz: which jazz wax was best? The beige badges glowed brightly at midnight. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!",
          focus: "difficult combos",
          fingers: false
        }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Lookup helpers                                                      */
  /* ------------------------------------------------------------------ */

  function allLessons() {
    var flat = [];
    for (var i = 0; i < CURRICULUM.length; i++) {
      var lessons = CURRICULUM[i].lessons;
      for (var j = 0; j < lessons.length; j++) {
        flat.push(lessons[j]);
      }
    }
    return flat;
  }

  function getLesson(id) {
    var lessons = allLessons();
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].id === id) return lessons[i];
    }
    return null;
  }

  function nextLesson(id) {
    var lessons = allLessons();
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].id === id) {
        return (i + 1 < lessons.length) ? lessons[i + 1] : null;
      }
    }
    return null;
  }

  function lessonByIndex(levelIndex, lessonIndex) {
    if (levelIndex < 0 || levelIndex >= CURRICULUM.length) return null;
    var lessons = CURRICULUM[levelIndex].lessons;
    if (lessonIndex < 0 || lessonIndex >= lessons.length) return null;
    return lessons[lessonIndex];
  }

  /* Accepts a Set or an array of attempted lesson ids. */
  function _containsId(coll, id) {
    if (!coll) return false;
    if (typeof coll.has === "function") return coll.has(id);
    if (typeof coll.indexOf === "function") return coll.indexOf(id) !== -1;
    return false;
  }

  /* Unlock rule: lesson i is unlocked when every lesson before it in course
   * order has at least one attempt, or when it is the first lesson. */
  function isUnlocked(lessonId, attemptedIdsSet) {
    var lessons = allLessons();
    var idx = -1;
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].id === lessonId) { idx = i; break; }
    }
    if (idx === -1) return false;
    if (idx === 0) return true;
    for (var j = 0; j < idx; j++) {
      if (!_containsId(attemptedIdsSet, lessons[j].id)) return false;
    }
    return true;
  }

  function courseProgress(attemptedIdsSet) {
    var lessons = allLessons();
    var done = 0;
    for (var i = 0; i < lessons.length; i++) {
      if (_containsId(attemptedIdsSet, lessons[i].id)) done++;
    }
    return { done: done, total: lessons.length };
  }

  /* ------------------------------------------------------------------ */
  /* WORD_LISTS — real, common English words for the games.              */
  /* easy: 3-5 letters. medium: 5-8 letters. hard: 8+ letters.           */
  /* No duplicates within a list. Games add punctuation themselves.      */
  /* ------------------------------------------------------------------ */
  var WORD_LISTS = {
    easy: [
      "cat","dog","sun","run","fun","top","box","bed","red","pen",
      "cup","map","hat","bat","rat","sat","mat","van","bag","log",
      "fog","hop","pop","mop","dot","hot","pot","cot","got","lot",
      "kid","lid","big","pig","dig","wig","zip","rip","lip","sip",
      "tip","mix","fix","six","sad","lad","fad","dad","had","ask",
      "all","add","and","the","you","she","him","his","her","was",
      "are","for","not","but","can","has","get","let","put","say",
      "too","use","old","new","see","way","who","boy","did","its",
      "day","man","how","out","our","one","two","now","why","yes",
      "off","own","may","sky","dry","fly","try","cry","shy","play",
      "jump","swim","walk","talk","sing","bird","fish","frog","bear",
      "wolf","cake","milk","rice","soup","door","bell","book","desk",
      "lamp","clock","ball","doll","kite","boat","star","moon","rain",
      "snow","wind","leaf","tree","rock","sand","wave","blue","pink",
      "gray","fast","slow","high","long","good","best","kind","warm",
      "cool","dark","soft","king","queen","horse","sheep","goat","dance",
      "funny","silly","brave","proud","lucky","magic","happy"
    ],
    medium: [
      "apple","house","water","light","table","chair","bread","smile",
      "train","music","paper","money","store","plant","beach","fruit",
      "juice","sweet","quick","brown","black","white","green","small",
      "large","great","first","other","every","never","always","often",
      "under","about","again","after","before","could","would","should",
      "their","there","these","those","which","while","where","seven",
      "eight","three","march","april","august","orange","purple","yellow",
      "dragon","knight","pirate","castle","early","earth","heart","learn",
      "dream","sleep","laugh","story","world","photo","video","radio",
      "phone","email","lunch","dinner","snake","tiger","zebra","monkey",
      "rabbit","turtle","spider","garden","flower","grass","stone","river",
      "ocean","forest","desert","island","cloud","storm","summer","winter",
      "spring","autumn","season","color","shape","round","square","circle",
      "clever","gentle","mango","lemon","peach","grape","melon","berry",
      "pizza","pasta","cheese","butter","honey","sugar","onion","carrot",
      "potato","tomato","pepper","candy","cookie","donut","muffin","pancake",
      "waffle","sandwich","burger","fries","salad"
    ],
    hard: [
      "computer","keyboard","internet","practice","wonderful","fantastic",
      "beautiful","mountain","elephant","sunshine","challenge","sentence",
      "paragraph","notebook","backpack","blackboard","children","breakfast",
      "afternoon","midnight","together","sometimes","software","hardware",
      "javascript","function","variable","discover","inventor","scientist",
      "festival","celebrate","birthday","vacation","treasure","adventure",
      "accuracy","beginner","champion","building","flamingo","kangaroo",
      "crocodile","butterfly","caterpillar","grasshopper","honeybee","dragonfly",
      "waterfall","lightning","hurricane","blizzard","twilight","wireless",
      "bluetooth","joystick","homework","classroom","chalkboard","textbook",
      "principal","playground","neighbor","community","universe","astronaut",
      "satellite","telescope","spaghetti","chocolate","strawberry","blueberry",
      "pineapple","watermelon","vegetable","cucumber","broccoli","asparagus",
      "happiness","kindness","patience","friendship","laughter","brilliant",
      "tomorrow","yesterday","dinosaur","earthquake","avalanche","continent",
      "lighthouse","airplane","helicopter","spaceship","submarine","sailboat",
      "souvenir","painting","sculpture","symphony","orchestra","basketball",
      "swimming","baseball","football","volleyball","badminton","marathon",
      "teammate","mattress","bathroom","basement","sprinkler","wheelbarrow",
      "sneakers","umbrella","raincoat","sunglasses","starfish","seahorse",
      "jellyfish","backstroke","freestyle","snowboard","skateboard"
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Public registration                                                 */
  /* ------------------------------------------------------------------ */
  TS.data = {
    CURRICULUM: CURRICULUM,
    WORD_LISTS: WORD_LISTS,
    getLesson: getLesson,
    allLessons: allLessons,
    nextLesson: nextLesson,
    lessonByIndex: lessonByIndex,
    isUnlocked: isUnlocked,
    courseProgress: courseProgress
  };

})();
