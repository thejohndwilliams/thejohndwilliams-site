// Placeholder case study on /work. A normal build leaves this false.
// Set PUBLIC_SHOW_CASE_STUDY=true only for a preview John has asked to see.
// Counsel clears any real text before that flag is flipped.
export const showCaseStudy = import.meta.env.PUBLIC_SHOW_CASE_STUDY === 'true';
