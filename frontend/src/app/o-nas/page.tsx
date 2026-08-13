import type { Metadata } from 'next';
import StronaTresci from '@/components/tresc/StronaTresci';
import SekcjaTresci from '@/components/tresc/SekcjaTresci';
import { ContactMail } from '@/components/legal/LegalSection';
import { O_NAS } from '@/content/oNas';
import { aboutPageJsonLd } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'O nas',
  description: 'Kto robi Bojo, dlaczego powstało i skąd pochodzą dane o boiskach.',
  alternates: { canonical: '/o-nas' },
};

export default function ONasPage() {
  return (
    <StronaTresci
      nadtytul="Bojo"
      h1="Kto robi Bojo"
      lead="Krótko: kto stoi za aplikacją, po co ją budujemy i na czym w przyszłości zamierzamy zarabiać."
      tytulDlaOkruszkow="O nas"
    >
      <SekcjaTresci id="kto-tworzy" tytul={O_NAS.ktoTworzy.tytul}>
        <p>
          {O_NAS.ktoTworzy.akapity[0]}
          <ContactMail />.
        </p>
      </SekcjaTresci>

      <SekcjaTresci id="dlaczego" tytul={O_NAS.dlaczego.tytul}>
        {O_NAS.dlaczego.akapity.map((a, i) => <p key={i}>{a}</p>)}
      </SekcjaTresci>

      <SekcjaTresci id="na-czym-zarabiamy" tytul={O_NAS.naCzymZarabiamy.tytul}>
        {O_NAS.naCzymZarabiamy.akapity.map((a, i) => <p key={i}>{a}</p>)}
      </SekcjaTresci>

      <SekcjaTresci id="skad-dane" tytul={O_NAS.skadDaneOBoiskach.tytul}>
        {O_NAS.skadDaneOBoiskach.akapity.map((a, i) => <p key={i}>{a}</p>)}
      </SekcjaTresci>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd()) }}
      />
    </StronaTresci>
  );
}
