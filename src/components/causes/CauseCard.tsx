import { useNavigate } from 'react-router-dom'
import { Heart, Users, Calendar, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Campaign } from '@/hooks/useCampaigns'

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function progressPct(raised: number, goal: number | null) {
  if (!goal || goal <= 0) return null
  return Math.min(100, Math.round((raised / goal) * 100))
}

export default function CauseCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate()
  const isDirectCampaign = campaign.campaign_type === 'direct'
  const days = campaign.release_date ? daysUntil(campaign.release_date) : 0
  const pct = progressPct(campaign.total_raised, campaign.goal_amount)

  return (
    <div
      className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer flex flex-col"
      onClick={() => navigate(`/causes/${campaign.slug}`)}
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/10 flex-shrink-0">
        {campaign.image_url ? (
          <img
            src={campaign.image_url}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Heart className="w-16 h-16 text-primary/30" />
          </div>
        )}
        {campaign.status === 'completed' && (
          <Badge className="absolute top-3 right-3 bg-green-600 text-white">Funded</Badge>
        )}
        <div className="absolute bottom-3 left-3">
          <Badge variant="secondary" className="bg-black/60 text-white border-0 backdrop-blur-sm flex items-center gap-1 text-xs">
            <Lock className="w-3 h-3" />
            {isDirectCampaign ? 'Direct Donation' : 'XRPL Escrow'}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {campaign.title}
        </h3>

        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4 flex-1">
          {campaign.description}
        </p>

        {/* Progress bar */}
        {pct !== null && (
          <div className="mb-3">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {campaign.total_raised.toLocaleString()} {campaign.currency} raised
              </span>
              <span>{pct}% of goal</span>
            </div>
          </div>
        )}

        {!pct && campaign.total_raised > 0 && (
          <p className="text-sm font-medium text-foreground mb-3">
            {campaign.total_raised.toLocaleString()} {campaign.currency} raised
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {campaign.donor_count} donor{campaign.donor_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {isDirectCampaign ? 'Open-ended' : (days > 0 ? `${days}d until release` : 'Funds released')}
          </span>
        </div>

        <Button
          className="w-full"
          variant={campaign.status === 'completed' ? 'outline' : 'default'}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/causes/${campaign.slug}`)
          }}
        >
          <Heart className="w-4 h-4 mr-2" />
          {campaign.status === 'completed' ? 'View Campaign' : 'Donate Now'}
        </Button>
      </div>
    </div>
  )
}
