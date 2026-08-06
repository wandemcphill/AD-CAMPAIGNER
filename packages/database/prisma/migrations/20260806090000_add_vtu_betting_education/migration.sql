-- ClubKonnect also supports bet funding and education (WAEC/JAMB) ePins — extend
-- VtuProductType so VtuOrder rows can represent these using the existing table
-- (metadata JSON holds billerCode/examType, same pattern as electricity/cable).

ALTER TYPE "VtuProductType" ADD VALUE IF NOT EXISTS 'BETTING';
ALTER TYPE "VtuProductType" ADD VALUE IF NOT EXISTS 'EDUCATION';
