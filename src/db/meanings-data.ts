/**
 * Short glosses for the seeded cue words (and the concept word itself), shown on the
 * results word map. Written for this project in plain dictionary style; Wiktionary was
 * consulted only to check senses, no text was copied. Admins can edit them in /admin/words.
 * Canonical Uzbek uses the ASCII apostrophe; displayUz() renders oʻ/gʻ/ʼ.
 */
export interface Meaning {
  uz: string;
  en: string;
  ru: string;
}

export interface SeedMeaning extends Meaning {
  related: string[];
}

export const SEED_MEANINGS: Record<string, SeedMeaning> = {
  "ma'naviyat": {
    uz: "Inson yoki jamiyatning axloqiy, ruhiy, ma'rifiy va madaniy qarashlari, qadriyatlari va ichki dunyosi majmui.",
    en: "The moral, intellectual and cultural values and inner world of a person or society; spirituality.",
    ru: "Совокупность нравственных, духовных, просветительских и культурных ценностей человека или общества; духовность.",
    related: ["axloq", "ruhiyat", "qadriyat", "madaniyat", "ma'rifat"],
  },
  "ruhiyat": {
    uz: "Insonning ichki ruhiy holati: kayfiyati, his-tuyg'ulari va fikrlash tarzi.",
    en: "A person's inner mental and emotional state; psyche, mood and frame of mind.",
    ru: "Внутреннее душевное состояние человека: психика, настроение, чувства и склад мыслей.",
    related: ["ruh", "qalb", "kayfiyat", "ma'naviyat"],
  },
  "axloq": {
    uz: "Jamiyatda nima yaxshi va nima yomon ekanini belgilovchi xulq-atvor qoidalari va me'yorlari majmui.",
    en: "The principles and norms of conduct that define right and wrong behaviour; morality.",
    ru: "Совокупность норм и принципов поведения, определяющих, что хорошо и что плохо; нравственность.",
    related: ["odob", "vijdon", "xulq", "insoniylik", "ma'naviyat"],
  },
  "odob": {
    uz: "Odamlar bilan muomalada hurmat, xushmuomalalik va jamiyatda qabul qilingan yurish-turish qoidalariga rioya qilish.",
    en: "Good manners: courtesy, respect and following accepted rules of behaviour when dealing with others.",
    ru: "Воспитанность: вежливость, уважение и соблюдение принятых правил поведения в общении с людьми.",
    related: ["axloq", "tarbiya", "hurmat", "kamtarlik", "adab"],
  },
  "iymon": {
    uz: "Diniy ta'limot haqiqatiga, ayniqsa Xudoga chin dildan ishonish; keng ma'noda mustahkam e'tiqod.",
    en: "Sincere belief in the truths of a religion, especially in God; more broadly, firm conviction.",
    ru: "Искренняя вера в истины религии, прежде всего в Бога; в широком смысле — твёрдое убеждение.",
    related: ["e'tiqod", "diniylik", "ishonch", "din", "vijdon"],
  },
  "qadriyat": {
    uz: "Inson yoki jamiyat muhim va asrashga arziydigan deb biladigan g'oya, tamoyil yoki an'ana.",
    en: "Something a person or society regards as important and worth preserving: an idea, principle or tradition.",
    ru: "То, что человек или общество считает важным и достойным сохранения: идея, принцип или традиция.",
    related: ["an'ana", "ma'naviyat", "madaniyat", "urf-odat", "milliy g'urur"],
  },
  "vijdon": {
    uz: "Insonning o'z xatti-harakatlarini ichdan baholaydigan, yaxshi va yomonni ajratadigan axloqiy tuyg'usi.",
    en: "The inner moral sense that judges one's own actions and tells right from wrong; conscience.",
    ru: "Внутреннее нравственное чувство, оценивающее собственные поступки и отличающее добро от зла; совесть.",
    related: ["insof", "diyonat", "axloq", "iymon", "poklik"],
  },
  "tarbiya": {
    uz: "Bola yoki shaxsga odob, axloq va hayotiy ko'nikmalarni singdirish jarayoni hamda uning natijasi.",
    en: "Upbringing: instilling manners, morals and life skills in a child or person; also its result.",
    ru: "Воспитание: привитие ребёнку или человеку манер, нравственности и жизненных навыков, а также его результат.",
    related: ["odob", "ta'lim", "oila", "axloq", "intizom"],
  },
  "qalb": {
    uz: "Yurak; ko'chma ma'noda insonning his-tuyg'ulari, ichki dunyosi va ruhi.",
    en: "The heart; figuratively, a person's feelings, inner world and soul.",
    ru: "Сердце; в переносном смысле — чувства, внутренний мир и душа человека.",
    related: ["yurak", "dil", "ruhiyat", "muhabbat", "vijdon"],
  },
  "madaniyat": {
    uz: "Xalq yaratgan moddiy va ma'naviy boyliklar majmui; shuningdek, kishining odob va bilim darajasi.",
    en: "The material and spiritual achievements of a people; also a person's level of manners and education.",
    ru: "Материальные и духовные достижения народа; также уровень воспитанности и образованности человека.",
    related: ["ma'naviyat", "san'at", "an'ana", "ma'rifat", "odob"],
  },
  "ezgulik": {
    uz: "Boshqalarga naf keltiradigan yaxshi niyat va xayrli ishlar; yovuzlikning aksi.",
    en: "Goodness: kind intentions and good deeds that benefit others; the opposite of evil.",
    ru: "Добро: благие намерения и добрые дела на пользу другим; противоположность злу.",
    related: ["yaxshilik", "mehr", "saxiylik", "insoniylik", "olijanoblik"],
  },
  "diniylik": {
    uz: "Insonning dinga e'tiqod qilishi va diniy amallarga rioya qilish darajasi; dindorlik.",
    en: "Religiosity: the degree to which a person holds religious beliefs and observes religious practices.",
    ru: "Религиозность: степень приверженности человека религиозной вере и соблюдения религиозных обрядов.",
    related: ["iymon", "e'tiqod", "din", "dindorlik", "ibodat"],
  },
  "komillik": {
    uz: "Aqliy, axloqiy va ma'naviy jihatdan yetuklik; barkamol inson bo'lish holati.",
    en: "Maturity and wholeness of mind, character and spirit; being a well-rounded, accomplished person.",
    ru: "Зрелость и цельность ума, характера и духа; состояние всесторонне развитой личности.",
    related: ["mukammallik", "barkamollik", "yetuklik", "ma'rifat", "ma'naviyat"],
  },
  "e'tiqod": {
    uz: "Biror g'oya, ta'limot yoki dinga chuqur ishonch va unga sodiqlik.",
    en: "Deep belief in and commitment to an idea, teaching or religion; conviction, creed.",
    ru: "Глубокая вера в идею, учение или религию и приверженность ей; убеждение, вероисповедание.",
    related: ["iymon", "ishonch", "diniylik", "sadoqat", "din"],
  },
  "vatanparvarlik": {
    uz: "Vatanni sevish va uning manfaati, ravnaqi uchun xizmat qilishga tayyorlik.",
    en: "Patriotism: love for one's homeland and readiness to serve its interests and wellbeing.",
    ru: "Патриотизм: любовь к родине и готовность служить её интересам и процветанию.",
    related: ["vatan", "milliy g'urur", "fidoyilik", "sadoqat", "jonkuyarlik"],
  },
  "muhabbat": {
    uz: "Kimgadir yoki nimagadir bo'lgan chuqur mehr, iliq tuyg'u va bog'lanish; sevgi.",
    en: "Love: deep affection, warmth and attachment towards someone or something.",
    ru: "Любовь: глубокая привязанность и тёплое чувство к кому-либо или чему-либо.",
    related: ["sevgi", "mehr", "qalb", "sadoqat", "oila"],
  },
  "sadoqat": {
    uz: "Kishiga, g'oyaga yoki burchga qat'iy va o'zgarmas vafodorlik.",
    en: "Steadfast loyalty and faithfulness to a person, an idea or a duty; devotion.",
    ru: "Твёрдая и неизменная верность человеку, идее или долгу; преданность.",
    related: ["vafo", "sadoqatlilik", "muhabbat", "ishonch", "fidoyilik"],
  },
  "ma'rifat": {
    uz: "Bilim, ilm va ongli tushunish; kishini ma'naviy jihatdan yuksaltiradigan ziyo.",
    en: "Enlightenment: knowledge, learning and understanding that elevate a person morally and intellectually.",
    ru: "Просвещение: знания, образованность и понимание, возвышающие человека нравственно и умственно.",
    related: ["ilm", "bilim", "ta'lim", "ziyo", "ma'naviyat"],
  },
  "sabr": {
    uz: "Qiyinchilik, kutish yoki og'riqqa shoshilmay, xotirjam chidash qobiliyati.",
    en: "Patience: the ability to endure difficulty, waiting or pain calmly and without haste.",
    ru: "Терпение: способность спокойно, без спешки переносить трудности, ожидание или боль.",
    related: ["bardosh", "toqat", "chidam", "xotirjamlik", "intizom"],
  },
  "samimiyat": {
    uz: "Fikr va tuyg'ularni yashirmay, chin dildan va ochiq ifodalash; soxtalikning yo'qligi.",
    en: "Sincerity: openly and genuinely expressing one's thoughts and feelings without pretence.",
    ru: "Искренность: открытое и честное выражение мыслей и чувств без притворства.",
    related: ["to'g'riso'zlik", "rostgo'ylik", "halollik", "ochiqlik", "mehr"],
  },
  "farosat": {
    uz: "Odamlar va vaziyatni tez anglab, nozik jihatlarni sezish qobiliyati; zehn, idrok.",
    en: "Perceptiveness: the ability to quickly understand people and situations and notice subtle details.",
    ru: "Проницательность: способность быстро понимать людей и ситуации, замечать тонкие детали.",
    related: ["zehn", "aql", "idrok", "donolik", "ziyraklik"],
  },
  "to'g'rilik": {
    uz: "Halollik va adolatlilik; yolg'on va hiyla-nayrangdan xoli bo'lish.",
    en: "Uprightness: honesty and fairness, being free of lies and deceit.",
    ru: "Прямота: честность и справедливость, отсутствие лжи и обмана.",
    related: ["halollik", "to'g'riso'zlik", "adolat", "rostgo'ylik", "vijdon"],
  },
  "fidoyilik": {
    uz: "Boshqalar, xalq yoki ezgu maqsad uchun o'z manfaatidan kechishga tayyorlik.",
    en: "Selflessness: readiness to sacrifice one's own interests for others, one's people or a noble cause.",
    ru: "Самоотверженность: готовность жертвовать личными интересами ради других, народа или благой цели.",
    related: ["jonkuyarlik", "vatanparvarlik", "sadoqat", "saxiylik", "mardlik"],
  },
  "nafs": {
    uz: "Insonning jismoniy va dunyoviy xohish-istaklari; ko'pincha jilovlanishi lozim bo'lgan ehtiros.",
    en: "One's bodily and worldly desires and appetites, often seen as something to restrain.",
    ru: "Плотские и мирские желания и страсти человека, которые принято обуздывать.",
    related: ["hirs", "ehtiros", "xohish", "sabr", "poklik"],
  },
  "tartiblilik": {
    uz: "Ishlarni rejali, ozoda va belgilangan tartibda bajarish odati.",
    en: "Orderliness: the habit of doing things neatly, systematically and in a set order.",
    ru: "Аккуратность и организованность: привычка делать всё последовательно, опрятно и по порядку.",
    related: ["intizom", "tartib", "ozodalik", "mas'uliyat", "aniqlik"],
  },
  "o'zini o'zi tanqid": {
    uz: "O'z kamchilik va xatolarini xolis ko'rib, tan olish va tuzatishga intilish.",
    en: "Self-criticism: honestly recognising one's own faults and mistakes and trying to correct them.",
    ru: "Самокритика: честное признание собственных недостатков и ошибок и стремление их исправить.",
    related: ["vijdon", "xolislik", "kamtarlik", "mas'uliyat", "tanqid"],
  },
  "jonkuyarlik": {
    uz: "Boshqalar yoki biror ish uchun chin dildan qayg'urish va astoydil jon kuydirish.",
    en: "Wholehearted dedication: caring deeply about others or a cause and working hard for it.",
    ru: "Радение: искренняя забота о других или о деле и полная самоотдача ради них.",
    related: ["fidoyilik", "g'amxo'rlik", "mehr", "vatanparvarlik", "faollik"],
  },
  "poklik": {
    uz: "Tan, niyat va xulqning tozaligi; gunoh, yomon niyat va g'arazdan xolilik.",
    en: "Purity: cleanness of body, intentions and conduct; freedom from ill will and wrongdoing.",
    ru: "Чистота тела, помыслов и поведения; свобода от дурных намерений и проступков.",
    related: ["halollik", "tozalik", "iffat", "vijdon", "to'g'rilik"],
  },
  "saxiylik": {
    uz: "O'z mol-mulki, vaqti va mehrini boshqalar bilan ayamay baham ko'rish; qo'li ochiqlik.",
    en: "Generosity: willingly sharing one's possessions, time and kindness with others.",
    ru: "Щедрость: готовность охотно делиться с другими имуществом, временем и добротой.",
    related: ["ezgulik", "mehr", "himmat", "fidoyilik", "mehmondo'stlik"],
  },
  "intizom": {
    uz: "Belgilangan qoida va tartibga qat'iy rioya qilish, o'zini nazorat qila olish.",
    en: "Discipline: strictly following set rules and order, and being able to control oneself.",
    ru: "Дисциплина: строгое соблюдение установленных правил и порядка, умение владеть собой.",
    related: ["tartiblilik", "tartib", "mas'uliyat", "sabr", "tarbiya"],
  },
  "xolislik": {
    uz: "Hech kimning tarafini olmay, voqea va odamlarni adolatli, beg'araz baholash.",
    en: "Impartiality: judging events and people fairly, without bias or personal interest.",
    ru: "Беспристрастность: справедливая оценка событий и людей без предвзятости и личного интереса.",
    related: ["adolat", "haqqoniylik", "to'g'rilik", "insof", "o'zini o'zi tanqid"],
  },
  "mukammallik": {
    uz: "Kamchiliksiz, to'liq va eng yuqori darajaga yetgan holat; barkamollik.",
    en: "Perfection: the state of being complete, flawless and of the highest quality.",
    ru: "Совершенство: состояние полноты, безупречности и наивысшего качества.",
    related: ["komillik", "barkamollik", "yetuklik", "kamolot", "sifat"],
  },
  "bag'rikenglik": {
    uz: "Boshqacha fikr, e'tiqod va turmush tarziga hurmat va sabr-toqat bilan munosabatda bo'lish.",
    en: "Tolerance: respecting and patiently accepting different views, beliefs and ways of life.",
    ru: "Толерантность: уважительное и терпимое отношение к иным взглядам, верованиям и образу жизни.",
    related: ["hurmat", "sabr", "insoniylik", "kamtarlik", "tinchlik"],
  },
  "kamtarlik": {
    uz: "O'zini boshqalardan ustun qo'ymaslik, maqtanmaslik va oddiy, kamsuqum bo'lish fazilati.",
    en: "Modesty: not placing oneself above others, not boasting, and staying humble.",
    ru: "Скромность: не ставить себя выше других, не хвастаться и оставаться простым.",
    related: ["odob", "oddiylik", "kamsuqumlik", "hurmat", "insoniylik"],
  },
  "insoniylik": {
    uz: "Odamlarga mehr, hamdardlik va hurmat bilan munosabatda bo'lish; odamiylik.",
    en: "Humaneness: treating people with kindness, compassion and respect.",
    ru: "Человечность: отношение к людям с добротой, сочувствием и уважением.",
    related: ["odamiylik", "mehr", "ezgulik", "bag'rikenglik", "vijdon"],
  },
  "sadoqatlilik": {
    uz: "Doimo sodiq va vafodor bo'lish xususiyati; sadoqatli insonga xos fazilat.",
    en: "The quality of being consistently loyal and faithful; loyalty as a personal trait.",
    ru: "Свойство быть неизменно верным и преданным; преданность как черта характера.",
    related: ["sadoqat", "vafodorlik", "ishonch", "muhabbat", "fidoyilik"],
  },
  "adolat": {
    uz: "Har kimga haqini berish, hammaga teng va xolis munosabatda bo'lish tamoyili.",
    en: "Justice: the principle of giving everyone their due and treating all equally and fairly.",
    ru: "Справедливость: принцип воздавать каждому должное и относиться ко всем равно и беспристрастно.",
    related: ["haqiqat", "xolislik", "to'g'rilik", "insof", "qonun"],
  },
  "to'g'riso'zlik": {
    uz: "Doimo rost gapirish, haqiqatni yashirmay ochiq aytish fazilati.",
    en: "Truthfulness: always telling the truth and speaking frankly without hiding it.",
    ru: "Правдивость: всегда говорить правду и открыто высказывать её, ничего не скрывая.",
    related: ["rostgo'ylik", "to'g'rilik", "samimiyat", "halollik", "vijdon"],
  },
  "faollik": {
    uz: "Ishda va jamiyat hayotida tashabbus ko'rsatib, g'ayrat bilan qatnashish.",
    en: "Activeness: taking initiative and participating energetically in work and community life.",
    ru: "Активность: инициативное и энергичное участие в работе и общественной жизни.",
    related: ["tashabbus", "g'ayrat", "jonkuyarlik", "mehnatsevarlik", "intizom"],
  },
  "milliy g'urur": {
    uz: "O'z xalqi, uning tarixi, madaniyati va yutuqlari bilan faxrlanish tuyg'usi.",
    en: "National pride: a feeling of pride in one's people, their history, culture and achievements.",
    ru: "Национальная гордость: чувство гордости за свой народ, его историю, культуру и достижения.",
    related: ["vatanparvarlik", "g'urur", "vatan", "qadriyat", "madaniyat"],
  },
  "erksevarlik": {
    uz: "Erkinlik va mustaqillikni qadrlash, zulm va qaramlikka bo'ysunmaslik.",
    en: "Love of freedom: valuing liberty and independence and refusing to submit to oppression.",
    ru: "Свободолюбие: стремление к свободе и независимости, неприятие угнетения и подчинения.",
    related: ["erkinlik", "mustaqillik", "ozodlik", "milliy g'urur", "vatanparvarlik"],
  },
};
