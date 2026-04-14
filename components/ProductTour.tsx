'use client';
import { useEffect, useRef, useCallback } from 'react';

const TOUR_KEY = 'financeiq:tour_completed';

interface ProductTourProps {
  autoStart?: boolean;
  onDone?: () => void;
}

export default function ProductTour({ autoStart = false, onDone }: ProductTourProps) {
  const tourRef = useRef<import('shepherd.js').Tour | null>(null);

  const startTour = useCallback(async () => {
    if (tourRef.current?.isActive()) return;

    const Shepherd = (await import('shepherd.js')).default;
    await import('shepherd.js/dist/css/shepherd.css');

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true, label: 'Lukk' },
        classes: 'fiq-tour-step',
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningPadding: 6,
        modalOverlayOpeningRadius: 8,
      },
    });

    tour.addStep({
      id: 'welcome',
      title: 'Velkommen til FinanceIQ 👋',
      text: 'La oss ta en rask gjennomgang av de viktigste funksjonene. Det tar bare et par minutter.',
      buttons: [
        { text: 'Hopp over', action: tour.cancel, classes: 'fiq-btn-skip' },
        { text: 'Kom i gang →', action: tour.next, classes: 'fiq-btn-primary' },
      ],
    });

    tour.addStep({
      id: 'send-invoice',
      attachTo: { element: '#tour-invoice-email', on: 'bottom' },
      title: '📧 Send fakturaer via e-post',
      text: `Videresend fakturaer til <strong>fakturaer@financeiq.no</strong> — AI-en leser PDF-vedlegget og lagrer dataene automatisk for deg.`,
      buttons: [
        { text: '← Forrige', action: tour.back, classes: 'fiq-btn-ghost' },
        { text: 'Neste →', action: tour.next, classes: 'fiq-btn-primary' },
      ],
    });

    tour.addStep({
      id: 'faktura-tab',
      attachTo: { element: '#tour-faktura-link', on: 'bottom' },
      title: '📄 Dine fakturaer',
      text: 'Her finner du alle fakturaer som er blitt sendt inn og analysert av AI. De er sortert per måned.',
      buttons: [
        { text: '← Forrige', action: tour.back, classes: 'fiq-btn-ghost' },
        { text: 'Neste →', action: tour.next, classes: 'fiq-btn-primary' },
      ],
    });

    tour.addStep({
      id: 'ai-tab',
      attachTo: { element: '#tour-ai-tab', on: 'bottom' },
      title: '🤖 AI-analyse',
      text: 'Få automatisk analyse av regnskapet ditt — AI-en gir deg innsikt, varsler og anbefalinger basert på dataene dine.',
      buttons: [
        { text: '← Forrige', action: tour.back, classes: 'fiq-btn-ghost' },
        { text: 'Neste →', action: tour.next, classes: 'fiq-btn-primary' },
      ],
    });

    tour.addStep({
      id: 'dashboard-tab',
      attachTo: { element: '#tour-dashboard-tab', on: 'bottom' },
      title: '📊 Oversikt',
      text: 'Dashbordet gir deg en fullstendig oversikt over inntekter, kostnader og resultat — med grafer og nøkkeltall.',
      buttons: [
        { text: '← Forrige', action: tour.back, classes: 'fiq-btn-ghost' },
        { text: 'Neste →', action: tour.next, classes: 'fiq-btn-primary' },
      ],
    });

    tour.addStep({
      id: 'help-btn',
      attachTo: { element: '#tour-help-btn', on: 'bottom' },
      title: '❓ Start tutorialen igjen',
      text: 'Klikk her når som helst for å se denne guiden på nytt.',
      buttons: [
        { text: '← Forrige', action: tour.back, classes: 'fiq-btn-ghost' },
        { text: 'Ferdig ✓', action: tour.complete, classes: 'fiq-btn-primary' },
      ],
    });

    tour.on('complete', () => {
      localStorage.setItem(TOUR_KEY, '1');
      onDone?.();
    });
    tour.on('cancel', () => {
      localStorage.setItem(TOUR_KEY, '1');
      onDone?.();
    });

    tourRef.current = tour;
    tour.start();
  }, [onDone]);

  // Auto-start on first visit
  useEffect(() => {
    if (!autoStart) return;
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) startTour();
  }, [autoStart, startTour]);

  // Expose startTour on the window so the help button can call it
  useEffect(() => {
    (window as Window & { __fiqStartTour?: () => void }).__fiqStartTour = startTour;
    return () => {
      delete (window as Window & { __fiqStartTour?: () => void }).__fiqStartTour;
    };
  }, [startTour]);

  return null;
}

export function useTour() {
  return {
    startTour: () => {
      (window as Window & { __fiqStartTour?: () => void }).__fiqStartTour?.();
    },
  };
}
