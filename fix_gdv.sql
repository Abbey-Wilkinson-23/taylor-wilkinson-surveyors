UPDATE postcode_surveyors
SET work_types = regexp_replace(work_types, 'GDV''?[Ss]?', 'GDV', 'g')
WHERE work_types ~* 'GDV''?s?';
