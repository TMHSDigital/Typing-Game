/**
 * Common Words in languages other than English: the 200 most frequent words
 * of each, in order, from FrequencyWords by Hermit Dave
 * (https://github.com/hermitdave/FrequencyWords, content/2018/<code>/<code>_50k.txt),
 * which counts words in OpenSubtitles. Words with characters other than
 * letters are left out, as are interjections and swear words.
 *
 * This file is licensed under CC BY-SA 4.0
 * (https://creativecommons.org/licenses/by-sa/4.0/), the license of that
 * content, not under the repository's Apache 2.0 license.
 */

// --- Word lists ---
// Keyed by language code. The English list is COMMON_WORDS in texts.js.
const WORD_LISTS = {
    // Spanish
    es: [
        'de', 'que', 'no', 'a', 'la', 'el', 'y', 'es', 'en', 'lo',
        'un', 'por', 'qué', 'me', 'una', 'los', 'se', 'te', 'con', 'para',
        'está', 'mi', 'pero', 'sí', 'si', 'bien', 'eso', 'su', 'las', 'yo',
        'del', 'como', 'aquí', 'tu', 'al', 'más', 'le', 'esto', 'todo', 'ya',
        'estoy', 'ahora', 'muy', 'ha', 'esta', 'así', 'vamos', 'algo', 'hay', 'bueno',
        'tengo', 'él', 'cuando', 'estás', 'sé', 'tú', 'nos', 'nada', 'cómo', 'este',
        'o', 'he', 'ser', 'tiene', 'puedo', 'ella', 'quiero', 'hacer', 'fue', 'gracias',
        'vez', 'era', 'soy', 'sólo', 'todos', 'porque', 'son', 'tienes', 'creo', 'voy',
        'sabes', 'estaba', 'puede', 'eres', 'ese', 'usted', 'entonces', 'hola', 'solo', 'verdad',
        'casa', 'tan', 'quién', 'sus', 'tiempo', 'dos', 'esa', 'nunca', 'dónde', 'va',
        'favor', 'mucho', 'mí', 'quieres', 'siento', 'señor', 'mejor', 'hace', 'has', 'decir',
        'también', 'sobre', 'dios', 'sin', 'tenemos', 'están', 'ti', 'puedes', 'ver', 'hombre',
        'vida', 'alguien', 'cosas', 'siempre', 'hasta', 'ahí', 'ir', 'años', 'antes', 'estar',
        'ni', 'poco', 'día', 'uno', 'noche', 'hecho', 'mis', 'estamos', 'otra', 'acuerdo',
        'trabajo', 'nosotros', 'parece', 'gente', 'sea', 'padre', 'mira', 'mismo', 'dijo', 'nadie',
        'quiere', 'podría', 'hablar', 'vas', 'ellos', 'tal', 'pasa', 'fuera', 'después', 'han',
        'desde', 'dinero', 'mundo', 'claro', 'momento', 'les', 'tener', 'estado', 'otro', 'había',
        'mañana', 'tenía', 'madre', 'vale', 'lugar', 'haciendo', 'donde', 'seguro', 'sabe', 'podemos',
        'tus', 'espera', 'nuevo', 'sido', 'cosa', 'hijo', 'allí', 'menos', 'tipo', 'amigo',
        'gran', 'nuestro', 'mujer', 'mamá', 'luego', 'papá', 'días', 'dice', 'hoy', 'tres',
    ],
    // French
    fr: [
        'de', 'je', 'est', 'pas', 'le', 'que', 'la', 'vous', 'tu', 'un',
        'à', 'et', 'il', 'a', 'ne', 'les', 'en', 'on', 'ça', 'une',
        'ce', 'pour', 'ai', 'des', 'qui', 'mais', 'dans', 'nous', 'elle', 'me',
        'bien', 'si', 'du', 'y', 'suis', 'non', 'avec', 'tout', 'plus', 'mon',
        'te', 'au', 'fait', 'moi', 'oui', 'va', 'était', 'as', 'faire', 'ils',
        'sur', 'quoi', 'se', 'comme', 'sais', 'être', 'veux', 'ici', 'ma', 'toi',
        'dit', 'lui', 'votre', 'es', 'pourquoi', 'où', 'là', 'rien', 'cette', 'sont',
        'quand', 'peux', 'dire', 'son', 'avez', 'vais', 'alors', 'ton', 'comment', 'par',
        'ou', 'chose', 'bon', 'ont', 'merci', 'juste', 'très', 'jamais', 'été', 'aussi',
        'avoir', 'vraiment', 'voir', 'même', 'sa', 'maintenant', 'tous', 'peut', 'deux', 'ces',
        'êtes', 'allez', 'ta', 'autre', 'peu', 'temps', 'quelque', 'fais', 'toujours', 'encore',
        'notre', 'mes', 'besoin', 'avait', 'accord', 'faut', 'dois', 'vie', 'aller', 'fois',
        'vu', 'donc', 'sans', 'monde', 'étais', 'parce', 'avant', 'sûr', 'trop', 'parler',
        'personne', 'avais', 'père', 'crois', 'après', 'aux', 'dieu', 'ses', 'pense', 'eu',
        'aime', 'leur', 'homme', 'viens', 'vrai', 'femme', 'doit', 'veut', 'ans', 'mal',
        'chez', 'déjà', 'depuis', 'beaucoup', 'vos', 'bonne', 'mort', 'mieux', 'vas', 'mère',
        'sera', 'dis', 'fille', 'tes', 'gens', 'quel', 'vois', 'désolé', 'voilà', 'avons',
        'petit', 'maison', 'soit', 'cela', 'autres', 'toute', 'soir', 'passé', 'prendre', 'jour',
        'monsieur', 'nos', 'savoir', 'choses', 'salut', 'cet', 'nom', 'argent', 'bonjour', 'nuit',
        'raison', 'moins', 'arrive', 'maman', 'reste', 'moment', 'voulais', 'seul', 'aider', 'air',
    ],
    // Portuguese
    pt: [
        'que', 'a', 'o', 'não', 'de', 'é', 'e', 'um', 'para', 'eu',
        'uma', 'está', 'com', 'se', 'do', 'por', 'os', 'ele', 'mas', 'em',
        'bem', 'isso', 'da', 'como', 'sim', 'as', 'no', 'mais', 'na', 'meu',
        'aqui', 'me', 'muito', 'foi', 'ela', 'isto', 'estou', 'fazer', 'vamos', 'já',
        'ser', 'vai', 'à', 'minha', 'só', 'ao', 'tem', 'tudo', 'te', 'porque',
        'há', 'tenho', 'vou', 'tu', 'sei', 'quando', 'agora', 'estás', 'você', 'lá',
        'então', 'ter', 'era', 'quem', 'onde', 'nada', 'ou', 'coisa', 'dizer', 'são',
        'quero', 'estava', 'sou', 'seu', 'pode', 'mesmo', 'esta', 'eles', 'nós', 'sua',
        'dos', 'todos', 'nos', 'mim', 'posso', 'bom', 'ver', 'este', 'casa', 'temos',
        'tens', 'tua', 'nunca', 'estão', 'até', 'assim', 'teu', 'acho', 'falar', 'disse',
        'ainda', 'tempo', 'também', 'ir', 'pai', 'sobre', 'vez', 'quê', 'quer', 'és',
        'favor', 'depois', 'tão', 'melhor', 'mãe', 'talvez', 'olá', 'obrigado', 'noite', 'ti',
        'sabes', 'sempre', 'deus', 'estamos', 'alguém', 'dia', 'certo', 'nem', 'alguma', 'vida',
        'anos', 'dele', 'sem', 'vais', 'das', 'tinha', 'estar', 'queres', 'coisas', 'homem',
        'pessoas', 'algo', 'pelo', 'ficar', 'boa', 'sabe', 'parece', 'claro', 'dois', 'verdade',
        'tipo', 'preciso', 'antes', 'senhor', 'lhe', 'podes', 'apenas', 'faz', 'vocês', 'ninguém',
        'trabalho', 'outra', 'espera', 'saber', 'comigo', 'vão', 'dinheiro', 'aí', 'podemos', 'pouco',
        'essa', 'esse', 'grande', 'pois', 'pela', 'qualquer', 'disso', 'num', 'qual', 'desculpa',
        'dela', 'hoje', 'toda', 'deve', 'mulher', 'queria', 'fora', 'filho', 'cá', 'seja',
        'meus', 'nosso', 'olha', 'vá', 'daqui', 'sério', 'nossa', 'certeza', 'diz', 'nome',
    ],
}; // prettier-ignore
