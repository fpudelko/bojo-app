// Jeden komentarz na zestaw zrzutów, aktualizowany w miejscu.
//
// Osobny plik, a nie `script:` wklejony w YAML-u, bo ta sama treść obsługuje
// dwa zadania (widoki publiczne i scenariusze za logowaniem) — a skopiowany
// kod w dwóch miejscach rozjeżdża się przy pierwszej poprawce.
//
// Komentarz rozpoznajemy po znaczniku (🖼️ / 🎬) w treści, żeby przy każdym
// kolejnym przebiegu nadpisać ten sam wpis zamiast zasypywać wątek.
//
// Zadaniem komentarza jest JEDNO: dać odnośnik do raportu. Niczego nie trzeba
// pisać w odpowiedzi — raport jest do obejrzenia, nie do zatwierdzania.

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
      '**Zdejmij etykietę** `zrzuty:zaakceptuj`, żeby kolejne przebiegi znowu',
      'porównywały, zamiast nadpisywać.',
    ].join('\n');
  } else if (udane) {
    tresc = [
      naglowek,
      '',
      'Wszystkie zrzuty zgadzają się ze wzorcami — nic się wizualnie nie ruszyło.',
    ].join('\n');
  } else if (obrazki) {
    tresc = [
      naglowek,
      '',
      'Widoki się zmieniły. To **nie jest** błąd sam w sobie — zmiana może być',
      'dokładnie tym, co chciałeś zrobić.',
      obrazki,
      '',
      '---',
      '',
      'Nowe wzorce wejdą do repo dopiero po nadaniu etykiety `zrzuty:zaakceptuj`',
      '(w aplikacji GitHuba: **ⓘ** w prawym dolnym rogu → *Labels*).',
      '',
      '_To zadanie nie blokuje merge\'a ani deployu._',
    ].join('\n');
  } else {
    // Brak obrazków przy nieudanym przebiegu znaczy coś innego niż zmiana
    // wyglądu: test padł zanim doszło do porównania — na asercji zachowania,
    // na braku przycisku, na wywróconym logowaniu. Mówienie wtedy „widoki się
    // zmieniły" wysyła w złą stronę.
    tresc = [
      naglowek,
      '',
      'Testy nie doszły do porównania widoków — coś padło wcześniej',
      '(asercja zachowania, brak elementu, logowanie). **Nie chodzi o wygląd.**',
      '',
      'Szczegóły są w logu przebiegu i w artefakcie z raportem.',
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
