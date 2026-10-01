import {
  AudienceSection,
  BeyondClinicalSection,
  BottomCta,
  CategoriesSection,
  ExploreSection,
  FeaturedExpertise,
  HeroSection,
  StatsBar,
} from '@/components/marketing/sections'

export default function LandingPage() {
  return (
    <>
      <HeroSection />
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
