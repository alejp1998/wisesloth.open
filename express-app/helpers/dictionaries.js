// dictionaries.js

// Nouns list
const nouns = [
  'dog', 'cat', 'human', 'horse', 'cow', 'sheep', 'goat', 'chicken', 'pig', 'duck',
  'elephant', 'tiger', 'lion', 'bear', 'wolf', 'fox', 'deer', 'rabbit', 'kangaroo', 'koala',
  'panda', 'raccoon', 'squirrel', 'mouse', 'rat', 'hamster', 'ferret', 'bat', 'hedgehog',
  'dolphin', 'whale', 'shark', 'octopus', 'squid', 'crab', 'lobster', 'jellyfish', 'starfish', 'coral',
  'salmon', 'trout', 'goldfish', 'tuna', 'sardine', 'eel', 'seahorse', 'stingray', 'seal', 'walrus',
  'penguin', 'ostrich', 'peacock', 'parrot', 'sparrow', 'eagle', 'hawk', 'owl', 'vulture', 'crow',
  'pigeon', 'dove', 'swan', 'flamingo', 'hummingbird', 'woodpecker', 'robin', 'stork', 'turkey', 'quail',
  'frog', 'toad', 'salamander', 'newt', 'gecko', 'iguana', 'chameleon', 'alligator', 'crocodile', 'turtle',
  'tortoise', 'snake', 'python', 'cobra', 'viper', 'rattlesnake', 'lizard', 'skink',
  'bee', 'butterfly', 'moth', 'ant', 'termite', 'fly', 'mosquito', 'dragonfly', 'grasshopper', 'cricket',
  'locust', 'beetle', 'ladybug', 'spider', 'scorpion', 'tick', 'flea', 'cockroach', 'centipede',
  'millipede', 'earthworm', 'leech', 'slug', 'snail', 'clam', 'oyster', 'mussel', 'scallop',
  'barnacle', 'krill', 'plankton', 'algae', 'kelp', 'seaweed', 'coral', 'fungus', 'mushroom',
  'yeast', 'bacteria', 'virus', 'protozoa', 'amoeba', 'paramecium', 'euglena', 'diatom', 'cactus',
  'grapevine', 'bamboo', 'fern', 'moss', 'ivy', 'rose', 'tulip', 'daffodil', 'sunflower',
  'daisy', 'lily', 'orchid', 'hibiscus', 'lavender', 'jasmine', 'marigold', 'poppy', 'violet', 'bluebell',
  'buttercup', 'clover', 'thistle', 'dandelion', 'carnation', 'cabbage', 'lettuce', 'spinach', 'carrot', 'beet',
  'radish', 'potato', 'tomato', 'onion', 'garlic', 'pepper', 'eggplant', 'zucchini', 'cucumber', 'pumpkin',
  'squash', 'corn', 'wheat', 'rice', 'barley', 'oat', 'soybean', 'peanut', 'almond', 'walnut',
  'hazelnut', 'chestnut', 'pecan', 'cashew', 'pistachio', 'grape', 'watermelon', 'melon', 'strawberry', 'blueberry',
  'raspberry', 'blackberry', 'cranberry', 'kiwi', 'pineapple', 'mango', 'papaya',
  'lychee', 'guava', 'fig', 'date', 'olive', 'avocado', 'plum', 'apricot', 'nectarine',
  'persimmon', 'artichoke', 'asparagus', 'broccoli', 'cauliflower', 'kale', 'arugula', 'chard',
  'turnip', 'parsnip', 'rutabaga', 'yam', 'ginger', 'turmeric', 'galangal', 'lemongrass',
  'basil', 'oregano', 'thyme', 'rosemary', 'sage', 'mint', 'coriander', 'parsley', 'cilantro', 'dill',
  'fennel', 'chive', 'tarragon', 'vanilla', 'cinnamon', 'clove', 'nutmeg', 'peppermint', 'spearmint',
  'anise', 'caraway', 'cumin', 'dragon', 'goblin', 'pixie', 'nymph', 'griffon', 'faerie', 'merman', 'satyr', 'imp',
  'orc', 'elf', 'djinni', 'troll', 'sprite', 'boggart', 'harpy', 'banshee', 'vampire',
  'wraith', 'ogre', 'gnome', 'doppel', 'hydra', 'sirens', 'dryad', 'selkie', 'wyvern',
  'hobbit', 'giant', 'phoenix', 'basilis', 'kelpie', 'kraken', 'ghoul', 'mantic',
  'centaur', 'gorgon', 'shapesh', 'lamia', 'naga', 'rakshas', 'leshen', 'golem',
  'chimera', 'demon', 'sphinx', 'sylph', 'wisp', 'gremlin', 'yokai', 'tarrasq',
  'boggart', 'kobold', 'undine', 'griffin', 'hobbit', 'selkie', 'djinn', 'wendigo', 'ifrit',
  'shade', 'nixie', 'sprite', 'faun', 'wyvern', 'ghoul', 'satyr', 'ogre', 'banshee', 'chupac',
  'ghast', 'yokai', 'tarrasq', 'imp', 'orc', 'elf', 'troll', 'lemure', 'eidolon', 'giant',
  'raksha', 'wight', 'medusa', 'naga', 'fiend', 'kelpie', 'sylph', 'djinni', 'yeti', 'kraken',
  'siren', 'harpy', 'drake', 'mimic', 'fey', 'shoggoth', 'gremlin'
];

// Adjectives list
const adjectives = [
  'zesty', 'bold', 'chill', 'quick', 'fresh', 'brave', 'smart', 'clean', 'sweet', 'funny',
  'shy', 'calm', 'neat', 'proud', 'light', 'small', 'young', 'sharp', 'grand', 'stern',
  'early', 'soft', 'loyal', 'tasty', 'crisp', 'mild', 'solid', 'vivid', 'jolly', 'vital',
  'vocal', 'faint', 'grave', 'tidy', 'nifty', 'brisk', 'swift', 'tight', 'sleek', 'cozy',
  'rosy', 'chirp', 'snug', 'perky', 'witty', 'quirk', 'plush', 'jazzy', 'shiny', 'quirk',
  'chirp', 'peppy', 'gloss', 'merry', 'zippy', 'dandy', 'cheer', 'sunny', 'broad', 'brief',
  'lithe', 'silly', 'crazy', 'quirk', 'giddy', 'bliss', 'chirp', 'tough', 'fair', 'vague',
  'chirp', 'peach', 'swift', 'grand', 'lucky', 'chic', 'flaky', 'cheek', 'spicy', 'lucky',
  'perky', 'noble', 'dandy', 'glad', 'perky', 'sleek', 'tidy', 'funny', 'clear', 'happy',
  'great', 'stern', 'tight', 'snappy', 'spicy', 'vivid', 'jazzy', 'humble'
];

// Fact-checked, precision-verified list with natural bilingual localization
const randomFacts = [
  {
    en: 'Honey never spoils; archaeologists have found pots of edible honey in ancient Egyptian tombs thousands of years old.',
    es: 'La miel nunca se echa a perder; los arqueólogos han encontrado vasijas con miel aún comestible de miles de años de antigüedad en tumbas del antiguo Egipto.'
  },
  {
    en: 'Botanically speaking, bananas, tomatoes, and watermelons are berries, while strawberries, raspberries, and blackberries are aggregate fruits.',
    es: 'Botánicamente, los plátanos, los tomates y las sandías son bayas, mientras que las fresas, frambuesas y moras son frutos agregados.'
  },
  {
    en: 'Octopuses have three hearts and blue blood because they use copper-based hemocyanin instead of iron-based hemoglobin to transport oxygen.',
    es: 'Los pulpos tienen tres corazones y sangre azul porque usan hemocianina a base de cobre en lugar de hemoglobina de hierro para transportar oxígeno.'
  },
  {
    en: 'A day on Venus (one full rotation taking 243 Earth days) is longer than its orbital year (225 Earth days).',
    es: 'Un día sideral en Venus (una rotación completa de 243 días terrestres) dura más que su año orbital (225 días terrestres).'
  },
  {
    en: 'Wombats produce cube-shaped droppings, which prevents them from rolling off rocks and helps mark territorial boundaries.',
    es: 'Los wombats producen heces en forma de cubo, lo que evita que rueden por las rocas y les ayuda a delimitar su territorio.'
  },
  {
    en: 'Sharks have existed for over 400 million years, making them older than trees, Saturn\'s rings, and dinosaurs.',
    es: 'Los tiburones han existido durante más de 400 millones de años, lo que significa que son más antiguos que los árboles, los anillos de Saturno y los dinosaurios.'
  },
  {
    en: 'Sloths move so slowly that specialized symbiotic algae grow directly on their fur, providing camouflage against predators.',
    es: 'Los perezosos se mueven tan despacio que crecen algas simbióticas directamente sobre su pelaje, proporcionándoles camuflaje natural.'
  },
  {
    en: 'Cows form close social bonds with preferred companions and exhibit measurable signs of stress when separated from them.',
    es: 'Las vacas desarrollan fuertes lazos de amistad con compañeras preferidas y muestran signos medibles de estrés cuando se las separa.'
  },
  {
    en: 'The Eiffel Tower can grow up to 15 cm (6 inches) taller in summer due to the thermal expansion of its puddle iron structure.',
    es: 'La Torre Eiffel puede llegar a medir hasta 15 cm más en verano debido a la dilatación térmica de su estructura de hierro pudelado.'
  },
  {
    en: 'Honeybees can recognize and remember individual human faces using holistic processing mechanisms similar to human vision.',
    es: 'Las abejas melíferas pueden reconocer y recordar rostros humanos individuales mediante un procesamiento visual holístico similar al nuestro.'
  },
  {
    en: 'Because octopuses lack internal skeletons, they can squeeze through any opening larger than their rigid chitinous beak.',
    es: 'Dado que carecen de esqueleto interno, los pulpos pueden deslizarse por cualquier abertura más ancha que su pico de quitina.'
  },
  {
    en: 'Polar bears have jet-black skin beneath their translucent, hollow hair follicles to absorb and retain heat from sunlight.',
    es: 'Los osos polares tienen la piel completamente negra debajo de su pelaje translúcido y hueco para absorber y retener el calor solar.'
  },
  {
    en: 'Horses can sleep standing up using an anatomical locking mechanism in their legs called the stay apparatus, though REM sleep requires lying down.',
    es: 'Los caballos pueden dormitar de pie gracias a un sistema de ligamentos llamado aparato de sostén pasivo, aunque para el sueño REM necesitan tumbarse.'
  },
  {
    en: 'Adult elephants are among the few large land mammals physically incapable of jumping, as they cannot lift all four feet off the ground at once.',
    es: 'Los elefantes adultos son de los pocos mamíferos terrestres grandes físicamente incapaces de saltar, ya que no pueden despegar las cuatro patas del suelo a la vez.'
  },
  {
    en: 'Crocodiles cannot stick their tongues out because the organ is held firmly in place by a membrane on the floor of the mouth.',
    es: 'Los cocodrilos no pueden sacar la lengua porque está fijada por una membrana a la base de la boca.'
  },
  {
    en: 'A blue whale\'s heart weighs approximately 180 kg (400 lbs), roughly the size and weight of a small golf cart.',
    es: 'El corazón de una ballena azul pesa unos 180 kg, unas dimensiones y masa comparables a las de un carrito de golf pequeño.'
  },
  {
    en: 'Koalas sleep between 18 and 22 hours per day to conserve energy, as their toxic, fibrous eucalyptus diet offers minimal caloric value.',
    es: 'Los koalas duermen entre 18 y 22 horas al día para ahorrar energía, ya que su dieta a base de eucalipto es muy baja en calorías y requiere una digestión lenta.'
  },
  {
    en: 'Ostriches are the fastest two-legged animals on Earth, capable of reaching sustained sprint speeds of up to 70 km/h (43 mph).',
    es: 'Los avestruces son los animales bípedos más rápidos del mundo, capaces de mantener velocidades de carrera de hasta 70 km/h.'
  },
  {
    en: 'Weight for weight, major ampullate spider silk has a tensile strength comparable to high-grade alloy steel and greater elasticity than nylon.',
    es: 'A igualdad de peso, la seda de araña tiene una resistencia a la tracción comparable a la del acero aleado y una elasticidad superior a la del nailon.'
  },
  {
    en: 'Butterflies taste through chemoreceptors on their tarsi (feet) to check if a leaf is safe for their caterpillars to consume before laying eggs.',
    es: 'Las mariposas tienen quimiorreceptores en las patas que les permiten saborear las hojas y comprobar si son aptas antes de poner sus huevos.'
  },
  {
    en: 'Peanuts are subterranean legumes related to peas and beans, rather than botanical tree nuts.',
    es: 'Los cacahuetes (o maníes) son legumbres subterráneas emparentadas con los guisantes y las judías, y no frutos secos de árbol.'
  },
  {
    en: 'Camels have three eyelids per eye; the innermost is a translucent nictitating membrane that protects the eye from sand while maintaining vision.',
    es: 'Los camellos poseen tres párpados por ojo; el más interno es una membrana nictitante transparente que bloquea la arena sin impedirles la visión.'
  },
  {
    en: 'Rhinoceros horns are made entirely of agglutinated keratin, the exact same structural protein found in human hair and fingernails.',
    es: 'Los cuernos de rinoceronte están formados exclusivamente por queratina compacta, la misma proteína estructural del cabello y las uñas humanas.'
  },
  {
    en: 'Tigers have distinct striped skin beneath their coat, with patterns unique to each individual like human fingerprints.',
    es: 'Los tigres tienen la piel rayada debajo del pelaje con un patrón único e irrepetible para cada individuo, equivalente a una huella dactilar.'
  },
  {
    en: 'Dolphins practice unihemispheric slow-wave sleep, resting one brain hemisphere at a time so they can consciously surface to breathe and remain vigilant.',
    es: 'Los delfines practican el sueño unihemisférico: desconectan solo una mitad del cerebro para poder salir a respirar conscientemente y vigilar depredadores.'
  },
  {
    en: 'The cleaner wrasse (*Labroides dimidiatus*) is one of the few non-mammalian animals confirmed to pass the mirror self-recognition test.',
    es: 'El lábrido limpiador (*Labroides dimidiatus*) es una de las pocas especies no mamíferas que ha superado formalmente la prueba del autorreconocimiento en el espejo.'
  },
  {
    en: 'Giraffes have seven cervical neck vertebrae—the exact same number as humans, mice, and most other mammals.',
    es: 'Las jirafas tienen siete vértebras cervicales en el cuello, exactamente el mismo número que los humanos, los ratones y la mayoría de los mamíferos.'
  },
  {
    en: 'Koala fingerprints feature friction ridge patterns so nearly identical to human prints that they can fool forensic investigators.',
    es: 'Las huellas dactilares de los koalas presentan crestas papilares tan similares a las humanas que pueden llegar a confundir a los peritos forenses.'
  },
  {
    en: 'Sharks have cartilaginous skeletons rather than true bone, making them lighter, highly agile, and buoyant in water.',
    es: 'Los tiburones tienen esqueletos de cartílago en lugar de hueso, lo que los hace más ligeros, flexibles y maniobrables en el agua.'
  },
  {
    en: 'During severe droughts, land snails can seal their shells with a dried layer of mucus called an epiphragm and hibernate for up to three years.',
    es: 'Durante sequías extremas, los caracoles terrestres sellan su concha con una membrana de baba seca (epifragma) y pueden aletargarse hasta por tres años.'
  },
  {
    en: 'The longest officially recorded poultry flight was made by a bantam chicken named Sheena, covering 192.07 meters (630 ft 2 in) in 1985.',
    es: 'El vuelo de un ave de corral más largo registrado oficialmente lo logró una gallina bantam llamada Sheena, que recorrió 192,07 metros en 1985.'
  },
  {
    en: 'Domestic cats have 32 muscles in each ear, enabling them to independently rotate their pinnae by up to 180 degrees.',
    es: 'Los gatos domésticos tienen 32 músculos en cada oreja, lo que les permite rotar de forma independiente cada pabellón auricular hasta 180 grados.'
  },
  {
    en: 'Sea stars (starfish) have neither brains nor centralized blood systems, using a hydraulic water vascular network to move and feed.',
    es: 'Las estrellas de mar no tienen cerebro ni sangre; utilizan un sistema vascular acuífero hidráulico para desplazarse y alimentarse.'
  },
  {
    en: 'Certain species of turtles can absorb dissolved oxygen through vascularized bursae inside their cloaca while overwintering underwater.',
    es: 'Algunas especies de tortugas pueden absorber oxígeno disuelto a través de cavidades vascularizadas en su cloaca mientras pasan el invierno sumergidas.'
  },
  {
    en: 'In seahorses and pipefish, males possess a brood pouch where they fertilize, carry, and give birth to the young.',
    es: 'En los caballitos de mar y peces pipa, los machos cuentan con una bolsa incubadora donde fertilizan los óvulos, gestan y dan a luz a las crías.'
  },
  {
    en: 'Leafcutter ant workers can lift and carry fragments weighing up to 50 times their own body mass over long distances.',
    es: 'Las hormigas cortadoras de hojas pueden levantar y transportar fragmentos vegetales de hasta 50 veces su propio peso corporal durante largos trayectos.'
  },
  {
    en: 'A giraffe\'s tongue can extend up to 50 cm (20 in) and contains dense melanin concentrations, giving it a dark blue-purple hue that prevents sunburn.',
    es: 'La lengua de una jirafa puede medir hasta 50 cm y tiene un tono azul violáceo oscuro gracias a la melanina que la protege de las quemaduras del sol.'
  },
  {
    en: 'Flamingos hatch with grey down and acquire their pink and crimson coloration from carotenoid pigments in their diet of brine shrimp and blue-green algae.',
    es: 'Los flamencos nacen con plumaje gris y adquieren su color rosado gracias a los pigmentos carotenoides que consumen en artemias y algas microscópicas.'
  },
  {
    en: 'A blue whale\'s tongue alone can weigh roughly 2.7 metric tons, which is comparable to the weight of an adult Asian elephant.',
    es: 'La lengua de una ballena azul puede pesar alrededor de 2,7 toneladas métricas, una masa equivalente a la de un elefante asiático adulto.'
  },
  {
    en: 'There are approximately 3 trillion trees on Earth, significantly outnumbering the estimated 100 to 400 billion stars in the Milky Way galaxy.',
    es: 'Hay aproximadamente 3 billones de árboles en la Tierra, superando ampliamente a las 100 000 a 400 000 millones de estrellas de la Vía Láctea.'
  },
  {
    en: 'Male Adélie penguins collect smooth pebbles and present them to potential mates to build nest mounds during courtship.',
    es: 'Los pingüinos de Adelia machos recogen guijarros lisos y se los regalan a las hembras para construir el nido durante el cortejo.'
  },
  {
    en: 'Dogs possess up to 300 million olfactory receptor cells in their nasal cavities, compared to about 6 million in humans.',
    es: 'Los perros poseen hasta 300 millones de células receptoras olfativas en la cavidad nasal, en comparación con unos 6 millones en los humanos.'
  },
  {
    en: 'Crows and ravens can remember individual human faces, hold grudges against specific individuals, and warn other flock members of perceived threats.',
    es: 'Los cuervos pueden recordar rostros humanos concretos, guardar rencor hacia personas específicas y alertar al resto de la bandada sobre posibles amenazas.'
  },
  {
    en: 'Elephants demonstrate mirror self-recognition and show measurable signs of empathy, frequently consoling distressed group members.',
    es: 'Los elefantes son capaces de reconocerse en el espejo y muestran empatía activa, consolando con frecuencia a compañeros de manada en apuros.'
  },
  {
    en: 'Bottlenose dolphins use unique signature whistles that serve the functional equivalent of individual personal names.',
    es: 'Los delfines mulares utilizan silbidos distintivos individualizados que funcionan de manera equivalente a nombres propios.'
  },
  {
    en: 'Newborn kangaroo joeys measure only about 2 cm (0.8 in) at birth and crawl through maternal fur unaided into the pouch to nurse.',
    es: 'Las crías de canguro recién nacidas miden apenas 2 cm y trepan solas a través del pelaje de la madre hasta el marsupio para amamantarse.'
  },
  {
    en: 'The Arctic Ocean is the smallest and shallowest of Earth\'s five major oceans, spanning roughly 14 million square kilometers.',
    es: 'El océano Ártico es el más pequeño y menos profundo de los cinco grandes océanos del planeta, con unos 14 millones de kilómetros cuadrados de superficie.'
  },
  {
    en: 'Cheetahs can purr and chirp, but cannot roar because their hyoid bone is completely ossified and lacks an elastic vocal ligament.',
    es: 'Los guepardos pueden ronronear y piar, pero no rugir, ya que su hueso hioides está completamente osificado y carece de ligamento elástico.'
  },
  {
    en: 'Due to tidal friction, the Moon recedes from Earth at a measured rate of approximately 3.8 cm (1.5 inches) per year.',
    es: 'A causa de la fricción de las mareas, la Luna se aleja de la Tierra a una velocidad comprobada de unos 3,8 cm por año.'
  },
  {
    en: 'A standard cumulus cloud measuring 1 cubic kilometer holds approximately 500 metric tons of liquid water droplets.',
    es: 'Un cúmulo típico de 1 kilómetro cúbico contiene aproximadamente 500 toneladas métricas de microgotas de agua condensada.'
  },
  {
    en: 'Sunlight takes an average of 8 minutes and 20 seconds to travel roughly 150 million kilometers from the Sun to Earth.',
    es: 'La luz solar tarda un promedio de 8 minutos y 20 segundos en recorrer los aproximadamente 150 millones de kilómetros que separan el Sol de la Tierra.'
  },
  {
    en: 'Archerfish knock terrestrial prey down by accurately shooting pressurized jets of water at insects on overhanging foliage up to 1.5 meters away.',
    es: 'El pez arquero derriba presas terrestres disparando chorros de agua a presión con gran precisión contra insectos situados hasta a 1,5 metros de distancia.'
  },
  {
    en: 'Sea otters often hold paws while resting in kelp canopies to keep from drifting away in ocean currents.',
    es: 'Las nutrias marinas suelen agarrarse de las patas mientras descansan en lechos de algas para evitar ser arrastradas por las corrientes.'
  },
  {
    en: 'Roughly two-thirds of an octopus\'s neurons are located in its arms, allowing each limb to independently process sensory data and manipulate objects.',
    es: 'Cerca de dos tercios de las neuronas de un pulpo están en sus brazos, lo que permite a cada tentáculo procesar estímulos sensoriales y actuar de forma autónoma.'
  },
  {
    en: 'The pattern of ridges on a dog\'s nose print is completely unique to each individual, functioning much like a human fingerprint.',
    es: 'El relieve de la trufa nasal de cada perro es totalmente único e irrepetible, funcionando como una huella dactilar biométrica.'
  },
  {
    en: 'The Anglo-Zanzibar War of August 27, 1896, lasted between 38 and 45 minutes, making it the shortest recorded war in history.',
    es: 'La guerra anglo-zanzibariana del 27 de agosto de 1896 duró entre 38 y 45 minutos, lo que la convierte en el conflicto bélico más corto de la historia.'
  },
  {
    en: 'Charles Osborne experienced continuous hiccups for 68 years (from 1922 to 1990), holding the Guinness World Record for the longest hiccup attack.',
    es: 'Charles Osborne tuvo hipo continuo durante 68 años (de 1922 a 1990), poseyendo el récord Guinness por el ataque de hipo más prolongado documentado.'
  },
  {
    en: 'The small dot above the lowercase letters \'i\' and \'j\' is formally known in typography as a \'tittle\'.',
    es: 'El pequeño punto sobre las letras minúsculas «i» y «j» se denomina formalmente «tilde» o virgulilla en tipografía (en inglés, *tittle*).'
  },
  {
    en: 'Apples float in water because 20% to 25% of their total volume is composed of intercellular air spaces.',
    es: 'Las manzanas flotan en el agua debido a que entre el 20 % y el 25 % de su volumen está formado por bolsas de aire intercelulares.'
  },
  {
    en: 'One solar day on Mercury (from one sunrise to the next) lasts 176 Earth days—which is exactly two Mercury years (88 Earth days each).',
    es: 'Un día solar en Mercurio (de un amanecer al siguiente) dura 176 días terrestres, lo que equivale exactamente a dos años mercurianos (de 88 días cada uno).'
  },
  {
    en: 'Domestic and wild cats cannot perceive sweetness due to an evolutionary mutation that disabled their TAS1R2 taste receptor gene.',
    es: 'Los felinos no pueden percibir los sabores dulces debido a una mutación genética inactivadora en su gen receptor gustativo TAS1R2.'
  },
  {
    en: 'The human olfactory system has the biological capacity to discriminate between hundreds of billions, and potentially over one trillion, distinct scent mixtures.',
    es: 'El sistema olfativo humano tiene la capacidad biológica de discriminar entre cientos de miles de millones (e incluso más de un billón) de combinaciones de olores.'
  },
  {
    en: 'Hummingbirds are the only birds capable of sustained, controlled backwards and upside-down flight.',
    es: 'Los colibríes son las únicas aves capaces de realizar vuelos marcha atrás y boca abajo de forma sostenida y controlada.'
  },
  {
    en: 'The colossal squid has the largest documented eyes in the animal kingdom, measuring between 27 and 30 cm (11 to 12 inches) across.',
    es: 'El calamar colosal posee los ojos más grandes documentados del reino animal, con un diámetro de entre 27 y 30 cm.'
  },
  {
    en: 'Humans share roughly 50% of their protein-coding genes with bananas, reflecting foundational biological machinery common to all complex cellular life.',
    es: 'Los humanos compartimos cerca del 50 % de nuestros genes codificantes de proteínas con los plátanos, reflejo de procesos celulares básicos comunes a los eucariotas.'
  },
  {
    en: 'Jellyfish bodies are roughly 95% water and operate without a brain, central heart, blood, or bony skeleton.',
    es: 'El cuerpo de las medusas está compuesto en un 95 % por agua y subsiste sin cerebro, corazón, sangre ni esqueleto.'
  },
  {
    en: 'Controlled studies have demonstrated that adult butterflies and moths retain associative olfactory memories learned while they were caterpillars.',
    es: 'Estudios científicos han demostrado que las mariposas y polillas adultas conservan recuerdos asociativos del olor aprendidos durante su fase de oruga.'
  },
  {
    en: 'Bats are the only mammals capable of true, self-powered flapping flight; gliding mammals like flying squirrels merely glide through the air.',
    es: 'Los murciélagos son los únicos mamíferos capaces de realizar un vuelo activo autopropulsado; otros mamíferos como las ardillas voladoras solo planean.'
  },
  {
    en: 'Human infants are born with roughly 270 individual bones and cartilaginous models, which gradually fuse into 206 distinct bones by adulthood.',
    es: 'Los bebés humanos nacen con cerca de 270 elementos óseos y cartilaginosos, que se fusionan durante el crecimiento hasta conformar los 206 huesos del adulto.'
  },
  {
    en: 'The Great Wall of China is not visible from low Earth orbit with the unaided eye, as its materials blend with the soil and its width is too narrow.',
    es: 'La Gran Muralla China no se distingue a simple vista desde la órbita terrestre baja, ya que es demasiado estrecha y sus materiales se funden con el entorno.'
  },
  {
    en: 'Giant panda cubs weigh only 90 to 130 grams at birth, making them roughly 1/900th the weight of their mothers.',
    es: 'Las crías de panda gigante pesan solo entre 90 y 130 gramos al nacer, lo que representa cerca de 1/900 del peso de su madre.'
  },
  {
    en: 'Elephants produce low-frequency infrasound rumbles below 20 Hz that travel several kilometers through both air and seismic ground waves.',
    es: 'Los elefantes emiten infrasonidos de baja frecuencia por debajo de los 20 Hz que viajan varios kilómetros a través del aire y de ondas sísmicas en el suelo.'
  },
  {
    en: 'Wood frogs can endure having over 60% of their body water frozen during winter by flooding their tissues with high concentrations of glucose and urea.',
    es: 'Las ranas de bosque toleran la congelación de más del 60 % del agua de su cuerpo en invierno inundando sus tejidos con altas concentraciones de glucosa y urea.'
  },
  {
    en: 'Antarctica is geographically classified as the largest desert on Earth, with its interior plateau receiving less than 50 mm of precipitation per year.',
    es: 'La Antártida está clasificada como el desierto más grande del planeta, ya que su meseta interior recibe menos de 50 mm de precipitación anual.'
  },
  {
    en: 'Only female mosquitoes bite vertebrates, as they require blood-derived proteins to develop eggs; males feed strictly on floral nectar.',
    es: 'Solo las hembras de mosquito pican a vertebrados para obtener las proteínas necesarias para sus huevos; los machos se alimentan únicamente de néctar floral.'
  }
];

// Export the dictionary lists
exports.randomFacts = randomFacts;
exports.nouns = nouns;
exports.adjectives = adjectives;
