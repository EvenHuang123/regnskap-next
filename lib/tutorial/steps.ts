export interface TutorialStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  tip?: string;
  action?: {
    label: string;
    tab?: string;
    href?: string;
  };
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    icon: '👋',
    title: 'Velkommen til FinanceIQ!',
    description:
      'FinanceIQ er ditt enkle regnskapsverktøy for norske småbedrifter. ' +
      'Vi guider deg gjennom de viktigste funksjonene på bare 2 minutter.',
    tip: 'Du kan alltid starte opplæringen på nytt fra Innstillinger.',
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Oversikt – se hva som skjer',
    description:
      'Dashboardet viser deg inntekter, kostnader og resultat for inneværende måned. ' +
      'Røde varsler dukker opp automatisk når noe trenger oppmerksomhet.',
    tip: 'Klikk på «Oversikt»-fanen for å se dashboardet.',
    action: { label: 'Gå til Oversikt', tab: 'dashboard' },
  },
  {
    id: 'entry',
    icon: '✏️',
    title: 'Datainntasting – legg inn tall',
    description:
      'Gå til «Datainntasting» for å registrere inntekter og kostnader måned for måned. ' +
      'Tall lagres automatisk i skyen.',
    tip: 'Bruk tab-tasten for å hoppe raskt mellom feltene.',
    action: { label: 'Gå til Datainntasting', tab: 'entry' },
  },
  {
    id: 'fakturaer',
    icon: '🧾',
    title: 'Fakturaer – videresend til oss',
    description:
      'Send fakturaer som e-post til fakturaer@financeiq.no. ' +
      'Systemet leser PDF-en automatisk og oppretter fakturaen for deg – inkludert NS 4102-postering.',
    tip: 'Fakturaer vises under «Fakturaer»-lenken i navigasjonsmenyen.',
    action: { label: 'Se fakturaer', href: '/app/fakturaer' },
  },
  {
    id: 'suppliers',
    icon: '🏢',
    title: 'Leverandøranalyse – forstå kostnadene dine',
    description:
      'Under «Leverandører» ser du en oversikt over hvem du bruker mest penger hos, ' +
      'med AI-drevne sparetips og grafer over månedlig utvikling.',
    action: { label: 'Se leverandører', href: '/app/suppliers' },
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'AI-analyse – rådgiver på 5 sekunder',
    description:
      'Claude AI analyserer regnskapstallene dine og gir deg konkrete råd: ' +
      'hva går bra, hva bør forbedres, og hva du bør passe på neste måned.',
    tip: 'Analysen er tilpasset din bedriftstype.',
    action: { label: 'Prøv AI-analyse', tab: 'ai' },
  },
  {
    id: 'likviditet',
    icon: '💰',
    title: 'Likviditet – holder kontantene?',
    description:
      'Likviditetspanelet viser om du har nok penger på konto fremover, ' +
      'basert på historiske inntekter og utgifter.',
    action: { label: 'Se likviditet', tab: 'likviditet' },
  },
  {
    id: 'export',
    icon: '📤',
    title: 'Eksport – del med regnskapsfører',
    description:
      'Bruk eksport-knappen (øverst til høyre) for å laste ned en komplett Excel-fil ' +
      'med alle tall, fakturaer og NS 4102-posteringer – klar for regnskapsfører.',
    tip: 'Eksporten inkluderer MVA-beregning og dobbel bokføring.',
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: 'Innstillinger – sett opp bedriften',
    description:
      'Under «Innstillinger» registrerer du bedriftsnavn, ansatte og faste kostnader. ' +
      'Du kan også laste opp banktransaksjoner som CSV for automatisk matching.',
    action: { label: 'Gå til Innstillinger', tab: 'settings' },
  },
  {
    id: 'done',
    icon: '🎉',
    title: 'Du er klar!',
    description:
      'Nå kjenner du FinanceIQ. Start med å legge inn forrige måneds tall, ' +
      'eller videresend en faktura til fakturaer@financeiq.no.',
    tip: 'Trykk på ? øverst til høyre for å starte opplæringen på nytt.',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
