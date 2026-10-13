"""Application constants and configuration values."""

# ruff: noqa: E501

# Allowed image extensions for upload
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"}

# Maximum characters allowed in prompts
CHARACTERS_LIMIT = 50000

# Maximum image size in KB
MAX_IMAGE_SIZE_KB = 100

# Difficulty levels with descriptions and examples
DIFFICULTY_LEVELS = {
    "beginner": {
        "description": "Introduces fundamental knowledge with direct recall questions. Distractors are obviously incorrect, often from unrelated categories, making the correct answer easily identifiable even with minimal knowledge. Focus is on basic recognition.",
        "examples": [
            "What is the color of a typical banana? a) Blue (Clearly incorrect color for a ripe banana) b) Green (Color of unripe bananas, plausible but not typical) c) Yellow (Correct answer, typical color of a ripe banana) d) Purple (Clearly incorrect color for a banana)",
            "Which shape has three sides? a) Circle (Incorrect shape with no straight sides) b) Square (Incorrect shape with four sides) c) Triangle (Correct answer, shape with three sides) d) Rectangle (Incorrect shape with four sides and four right angles)",
            "A dog is a type of: a) Fish (Incorrect animal class, lives in water and breathes through gills) b) Bird (Incorrect animal class, has feathers and wings) c) Mammal (Correct answer, warm-blooded vertebrate animal with hair or fur, and females suckle their young) d) Reptile (Incorrect animal class, cold-blooded vertebrate animal with scales)",
        ],
    },
    "elementary": {
        "description": "Expands on basic concepts, requiring simple understanding and application. Distractors are related to the topic but are factually incorrect upon closer inspection. The correct answer requires slightly more thought but remains fairly straightforward for those with basic knowledge.",
        "examples": [
            "Water boils at 100 degrees Celsius at sea level. What happens to the boiling point if you go to a higher altitude? a) It stays the same (Incorrect, boiling point is altitude-dependent) b) It increases (Incorrect, boiling point decreases with lower atmospheric pressure) c) It decreases (Correct answer, due to lower atmospheric pressure at higher altitudes) d) It becomes unpredictable (Incorrect, the change is predictable based on altitude)",
            "Which of these is a primary color? a) Green (Incorrect, secondary color made by mixing primary colors) b) Orange (Incorrect, secondary color made by mixing primary colors) c) Red (Correct answer, a primary color that cannot be made by mixing other colors) d) Purple (Incorrect, secondary color made by mixing primary colors)",
            "Plants use sunlight to make food in a process called: a) Respiration (Incorrect, respiration is energy consumption, not food production) b) Digestion (Incorrect, digestion is breaking down food, not making it from sunlight) c) Photosynthesis (Correct answer, process used by plants to convert light energy into chemical energy) d) Decomposition (Incorrect, decomposition is breaking down dead organisms)",
        ],
    },
    "intermediate": {
        "description": "Tests understanding of core concepts and their application in typical scenarios. Distractors are plausible if misconceptions are present or if the question is superficially understood. Correct answer requires understanding the underlying principles and ruling out common confusions.",
        "examples": [
            "If you mix blue and yellow, what color do you get? a) Red (Incorrect, mixing red and yellow makes orange) b) Purple (Incorrect, mixing red and blue makes purple) c) Green (Correct answer, mixing blue and yellow results in green) d) Orange (Incorrect, mixing red and yellow makes orange)",
            "Which state of matter has a definite volume but no definite shape? a) Solid (Incorrect, solids have definite shape and volume) b) Gas (Incorrect, gases have neither definite volume nor shape) c) Liquid (Correct answer, liquids have definite volume but take the shape of their container) d) Plasma (Incorrect, plasma is ionized gas with no definite shape or volume in typical contexts)",
            "In which type of circuit are components arranged in a single path so that the current flows only in one direction? a) Parallel circuit (Incorrect, components are in separate branches) b) Series circuit (Correct answer, components are connected end-to-end in a single path) c) Short circuit (Incorrect, abnormal path of low resistance) d) Open circuit (Incorrect, circuit is broken and current cannot flow)",
        ],
    },
    "advanced": {
        "description": "Requires deeper analytical skills and application of knowledge to less obvious situations. Distractors are designed to be very plausible, often representing common errors in reasoning or closely related but incorrect concepts. The correct answer requires careful consideration of nuances and subtle differences.",
        "examples": [
            "Considering the principles of leverage, where should the fulcrum be placed to lift a heavy object with the least amount of force? a) Closer to the load (Correct answer, maximizes force advantage but requires larger movement distance) b) Closer to the effort (Incorrect, minimizes movement distance but requires more force) c) Exactly in the middle (Incorrect, provides balanced force and distance, not optimized for least force) d) It doesn't matter (Incorrect, fulcrum placement is crucial for leverage)",
            "Which of the following is a characteristic of a perfectly competitive market? a) High barriers to entry (Incorrect, perfect competition has low or no barriers) b) Product differentiation (Incorrect, products are homogenous in perfect competition) c) Many buyers and sellers (Correct answer, a key feature of perfect competition ensuring no single entity controls price) d) Price control by individual firms (Incorrect, firms are price takers in perfect competition)",
            "What is the primary function of the endoplasmic reticulum in a eukaryotic cell? a) Energy production (Incorrect, primary function of mitochondria) b) Protein and lipid synthesis (Correct answer, major function of the endoplasmic reticulum, especially the rough ER for proteins and smooth ER for lipids) c) Waste breakdown (Incorrect, primary function of lysosomes and vacuoles) d) DNA storage (Incorrect, primary function of the nucleus)",
        ],
    },
    "expert": {
        "description": "Challenges the ability to synthesize complex information, apply nuanced understanding, and critically evaluate highly plausible options. Distractors are very close to the correct answer, often valid in slightly different contexts or representing advanced misunderstandings. Identifying the correct answer demands deep insight, comprehensive knowledge, and the ability to discern subtle but critical distinctions; all options may appear defensible at first glance.",
        "examples": [
            "In the context of quantum mechanics, which phenomenon best illustrates wave-particle duality? a) Photoelectric effect (Incorrect, primarily illustrates particle nature of light) b) Compton scattering (Incorrect, primarily illustrates particle nature of light) c) Double-slit experiment (Correct answer, classic demonstration showing both wave and particle behavior of quantum entities) d) Brownian motion (Incorrect, classical physics phenomenon explained by molecular motion, not directly wave-particle duality)",
            "Which ethical framework would most strongly argue against the use of artificial intelligence in fully autonomous weapons systems, even if they could reduce civilian casualties in warfare? a) Utilitarianism (Incorrect, might support if overall casualties are minimized) b) Deontology (Correct answer, emphasizes moral duties and rules, likely opposing autonomous weapons due to lack of human moral agency and accountability) c) Consequentialism (Incorrect, similar to utilitarianism, focuses on outcomes and might justify if outcomes are better) d) Virtue ethics (Less directly applicable, focuses on character but less clear stance against specific technologies)",
            "Considering macroeconomic policy, under what conditions would expansionary fiscal policy be LEAST effective in stimulating economic growth? a) During a liquidity trap (Correct answer, monetary policy is ineffective, and fiscal policy also loses potency as increased government spending might just increase savings rather than investment and consumption) b) When there is significant slack in the economy (Incorrect, expansionary fiscal policy is generally effective here) c) When interest rates are already very low (Incorrect, fiscal policy can be more effective when monetary policy is limited by low interest rates) d) When consumer confidence is high (Incorrect, high consumer confidence is a favorable condition for fiscal policy to boost demand)",
        ],
    },
}
