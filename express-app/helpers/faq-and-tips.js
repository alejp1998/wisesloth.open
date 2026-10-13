const faqsList = [
  { en: { question: 'How do I share a quiz?', answer: 'Set its visibility to public and share its URL on your instance. Ask the host for accounts so others can take quizzes and save results.' }, es: { question: '¿Cómo comparto un test?', answer: 'Configura su visibilidad como pública y comparte su URL. Pide cuentas al administrador para guardar los resultados.' } },
];
const tipsList = [
  {
    questionEn: 'How to get better quality of your tests?',
    questionEs: '¿Cómo mejorar la calidad de tus tests?',
    answerEn: `
      Make sure the input text is long enough and well-structured. This allows WiseSloth.open to generate more diverse and accurate questions.
    `,
    answerEs: `
      Asegúrate de que el texto de entrada sea lo suficientemente largo y esté bien estructurado. Esto permite que WiseSloth.open genere preguntas más diversas y precisas.
    `,
  },
  {
    questionEn: 'What is the best way to study with WiseSloth.open?',
    questionEs: '¿Cuál es la mejor manera de estudiar con WiseSloth.open?',
    answerEn: `
      Start with beginner-level tests and gradually increase the difficulty as you become more confident. Track your progress and focus on weaker areas.
    `,
    answerEs: `
      Comienza con tests de nivel principiante y aumenta gradualmente la dificultad a medida que ganes confianza. Sigue tu progreso y concéntrate en las áreas más débiles.
    `,
  },
  {
    questionEn: 'How can educators use WiseSloth.open to engage students?',
    questionEs: '¿Cómo pueden los educadores usar WiseSloth.open para involucrar a los estudiantes?',
    answerEn: `
      Educators can create customized practice tests for any subject in seconds. Use them as a tool to diagnose knowledge gaps or to reinforce key concepts.
    `,
    answerEs: `
      Los educadores pueden crear tests de práctica personalizados sobre cualquier tema en segundos. Úsalos como una herramienta para diagnosticar lagunas de conocimiento o para reforzar conceptos clave.
    `,
  },
  {
    questionEn: 'How to challenge friends in WiseSloth.open?',
    questionEs: '¿Cómo desafiar a tus amigos en WiseSloth.open?',
    answerEn: `
      After creating a test, share the test link with your friends. You can then compete to see who scores the highest, making learning more engaging.
    `,
    answerEs: `
      Después de crear un test, comparte el enlace con tus amigos. Luego pueden competir para ver quién obtiene la mayor puntuación, haciendo el aprendizaje más interesante.
    `,
  },
  {
    questionEn: 'How can I make tests more personalized?',
    questionEs: '¿Cómo puedo personalizar más mis tests?',
    answerEn: `
      Provide specific instructions or key topics you want covered when generating a test. WiseSloth.open can create questions tailored to your unique learning goals.
    `,
    answerEs: `
      Proporciona instrucciones específicas o temas clave que quieras cubrir al generar un test. WiseSloth.open puede crear preguntas adaptadas a tus objetivos de aprendizaje.
    `,
  },
  {
    questionEn: 'Create tests from existing materials with the PDF upload',
    questionEs: 'Crea tests a partir de materiales existentes con la subida de PDF',
    answerEn: `
      If you already have class notes, slides, or an old exam, use the PDF upload in the Old Exam, Notes, or Flashcards tabs instead of pasting text.
      The pages you select are turned into questions automatically — and your file never leaves your device.
    `,
    answerEs: `
      Si ya tienes apuntes, diapositivas o un examen antiguo, usa la subida de PDF en las pestañas Examen, Apuntes o Flashcards en lugar de pegar texto.
      Las páginas que selecciones se convierten en preguntas automáticamente, y tu archivo nunca sale de tu dispositivo.
    `,
  },
  {
    questionEn: 'Study one question at a time',
    questionEs: 'Estudia una pregunta a la vez',
    answerEn: `
      Enable "Questions one by one" when you practice. Focusing on a single question reduces overwhelm and is great for building confidence
      before timed or full-length attempts.
    `,
    answerEs: `
      Activa "Preguntas una por una" al practicar. Centrarte en una sola pregunta reduce la sobrecarga y es ideal para ganar confianza
      antes de intentos completos o cronometrados.
    `,
  },
  {
    questionEn: 'Randomize to truly test your knowledge',
    questionEs: 'Aleatoriza para poner a prueba de verdad tu conocimiento',
    answerEn: `
      Turn on "Randomize questions" and "Randomize options" so you can't memorize the order. It makes every attempt a genuine test of what you know.
    `,
    answerEs: `
      Activa "Aleatorizar preguntas" y "Aleatorizar opciones" para que no memorices el orden. Así cada intento es una prueba real de lo que sabes.
    `,
  },
  {
    questionEn: 'Use Skills & Preferences to get the quiz you want',
    questionEs: 'Usa Skills & Preferences para conseguir el test que quieres',
    answerEn: `
      Before generating, set the skills you want (like real-world examples, math focus, or beginner friendly). The AI uses them to tailor the whole
      quiz, so be specific about your learning goals.
    `,
    answerEs: `
      Antes de generar, define las habilidades que quieras (como ejemplos del mundo real, enfoque en matemáticas o nivel principiante). La IA las usa
      para adaptar todo el test, así que sé específico sobre tus objetivos de aprendizaje.
    `,
  },
  {
    questionEn: 'Review with flashcards',
    questionEs: 'Repasa con flashcards',
    answerEn: `
      For vocabulary, definitions, or key concepts, generate a flashcard deck. Practice in short bursts: read the front, try to recall the answer,
      then flip to check.
    `,
    answerEs: `
      Para vocabulario, definiciones o conceptos clave, genera un mazo de flashcards. Practica en sesiones cortas: lee la cara, intenta recordar
      la respuesta y dale la vuelta para comprobar.
    `,
  },
  {
    questionEn: 'Host a Live Battle for group study',
    questionEs: 'Organiza una Live Battle para estudiar en grupo',
    answerEn: `
      Turn study time into a game. Create a Live Battle from a quiz, share the code with friends or classmates, and let the leaderboard decide
      who studied harder.
    `,
    answerEs: `
      Convierte el tiempo de estudio en un juego. Crea una Live Battle desde un test, comparte el código con amigos o compañeros y deja que
      la clasificación decida quién estudió más.
    `,
  },
  {
    questionEn: 'Fix questions with AI editing',
    questionEs: 'Arregla preguntas con la edición con IA',
    answerEn: `
      If a generated question feels off, don't recreate the whole quiz. Use the AI edit button on that question to rewrite it, or tweak it manually,
      and keep the rest.
    `,
    answerEs: `
      Si una pregunta generada no termina de convencerte, no recrees todo el test. Usa el botón de edición con IA en esa pregunta para reescribirla,
      o ajústala manualmente, y conserva el resto.
    `,
  },
  {
    questionEn: 'Combine notes and clear instructions',
    questionEs: 'Combina apuntes e instrucciones claras',
    answerEn: `
      The best quizzes come from good input. Paste well-structured notes and add a sentence of instructions (difficulty, topics, question style).
      Specific instructions produce more accurate and useful questions.
    `,
    answerEs: `
      Los mejores tests nacen de una buena entrada. Pega apuntes bien estructurados y añade una frase de instrucciones (dificultad, temas, estilo de preguntas).
      Las instrucciones específicas producen preguntas más precisas y útiles.
    `,
  },
  {
    questionEn: 'Practice consistently and track your progress',
    questionEs: 'Practica con constancia y sigue tu progreso',
    answerEn: `
      Take quizzes regularly and review your results — hits, misses, and omissions. Focus your next attempts on the topics where you score lowest.
    `,
    answerEs: `
      Haz tests con regularidad y revisa tus resultados — aciertos, fallos y omisiones. Centra tus próximos intentos en los temas donde obtengas peores puntuaciones.
    `,
  },
  {
    questionEn: 'Generate quizzes in any language',
    questionEs: 'Genera tests en cualquier idioma',
    answerEn: `
      WiseSloth.open works with text in any language. Paste content in the language you are studying, choose it in the language dropdown, and you'll get
      a quiz in that language.
    `,
    answerEs: `
      WiseSloth.open funciona con texto en cualquier idioma. Pega contenido en el idioma que estás estudiando, elígelo en el desplegable de idiomas y obtendrás
      un test en ese idioma.
    `,
  }
];


// Export the lists

module.exports = { faqsList, tipsList };
