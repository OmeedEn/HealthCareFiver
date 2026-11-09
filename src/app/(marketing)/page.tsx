import {
  AudienceSection,
  BeyondClinicalSection,
  BottomCta,
  CategoriesSection,
  ExploreSection,
  FeaturedExpertise,
  HeroSection,
  SpecialtyMarquee,
  StatsBar,
} from '@/components/marketing/sections'

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <SpecialtyMarquee />
      <StatsBar />
      <FeaturedExpertise />
      <CategoriesSection />
      <BeyondClinicalSection />
      <ExploreSection />
      <AudienceSection />
      <BottomCta />
    </>
  )
}
