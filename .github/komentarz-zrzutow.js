// Jeden komentarz na zestaw zrzutów, aktualizowany w miejscu.
//
// Osobny plik, a nie `script:` wklejony w YAML-u, bo ta sama treść obsługuje
// dwa zadania (widoki publiczne i scenariusze za logowaniem) — a skopiowany
// kod w dwóch miejscach rozjeżdża się przy pierwszej poprawce.
//
// Komentarz rozpoznajemy po znaczniku (🖼️ / 🎬) w treści, żeby przy każdym
// kolejnym przebiegu nadpisać ten sam wpis zamiast zasypywać wątek.

module.exports = async ({ github, context, znacznik, tytul, udane, akceptacja, obrazki, numer }) => {
  const { owner, repo } = context.repo;

  const naglowek = `### ${znacznik} ${tytul}`;
  let tresc;

  if (akceptacja) {
    tresc = [
      naglowek,
      '',
      '**Wzorce zaktualizowane.** Nowe obrazki trafiły na gałąź tego PR-a —',
      'zobaczysz je w zakładce *Files changed*.',
      '',
      'Kolejne przebiegi znowu porównują, bez nadpisywania.',
      'Jeśli akceptacja przyszła etykietą `zrzuty:zaakceptuj` — **zdejmij ją**.',
    ].join('\n');
  } else if (udane) {
    tresc = [
      naglowek,
      '',
      'Wszystkie zrzuty zgadzają się ze wzorcami — nic się wizualnie nie ruszyło.',
    ].join('\n');
  } else {
    tresc = [
      naglowek,
      '',
      'Widoki poniżej wymagają Twojego spojrzenia. To **nie jest** błąd sam w sobie:',
      'zmiana może być dokładnie tym, co chciałeś zrobić.',
      obrazki || '\n_(Obrazków nie udało się wystawić — są w artefakcie przebiegu.)_',
      '',
      '---',
      '',
      '**Wygląda dobrze?** Odpisz w tym wątku:',
      '',
      '```',
      '/zrzuty ok',
      '```',
      '',
      'Workflow wygeneruje wzorce i dopisze je do gałęzi PR-a. Komenda musi stać',
      'w osobnej linii — dzięki temu zacytowanie tego komentarza niczego nie odpala.',
      '',
      '_To zadanie nie blokuje merge\'a ani deployu._',
    ].join('\n');
  }

  const { data: komentarze } = await github.rest.issues.listComments({
    owner, repo, issue_number: numer, per_page: 100,
  });
  const moj = komentarze.find((k) => k.user.type === 'Bot' && k.body.includes(znacznik));

  if (moj) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: moj.id, body: tresc });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number: numer, body: tresc });
  }
};
