export type Language = 'en' | 'ta'

const dictionaries = {
  en: {
    overview: 'Overview', records: 'Records vault', timeline: 'Medical timeline', medications: 'Medications',
    health: 'Health summary', sharing: 'Share access', appointments: 'Appointments', emergency: 'Emergency card',
    activity: 'Activity log', patients: 'Authorized patients', requests: 'Access requests',
    signOut: 'Sign out', upload: 'Upload record', addMedication: 'Add medication', shareRecords: 'Share records',
    viewTimeline: 'View timeline', search: 'Search', demo: 'DEMO MODE',
    disclaimer: 'Fictional hackathon demo. Not a certified clinical system or medical advice.',
  },
  ta: {
    overview: 'கண்ணோட்டம்', records: 'மருத்துவ பதிவுகள்', timeline: 'மருத்துவ காலவரிசை', medications: 'மருந்துகள்',
    health: 'உடல்நலச் சுருக்கம்', sharing: 'அணுகலைப் பகிர்', appointments: 'சந்திப்புகள்', emergency: 'அவசர அட்டை',
    activity: 'செயல்பாட்டு பதிவு', patients: 'அங்கீகரிக்கப்பட்ட நோயாளிகள்', requests: 'அணுகல் கோரிக்கைகள்',
    signOut: 'வெளியேறு', upload: 'பதிவைப் பதிவேற்று', addMedication: 'மருந்தைச் சேர்', shareRecords: 'பதிவுகளைப் பகிர்',
    viewTimeline: 'காலவரிசையைப் பார்', search: 'தேடு', demo: 'டெமோ முறை',
    disclaimer: 'கற்பனை ஹேக்கத்தான் டெமோ. சான்றளிக்கப்பட்ட மருத்துவ அமைப்போ மருத்துவ ஆலோசனையோ அல்ல.',
  },
}

export function translate(language: Language, key: keyof typeof dictionaries.en): string {
  return dictionaries[language][key]
}
