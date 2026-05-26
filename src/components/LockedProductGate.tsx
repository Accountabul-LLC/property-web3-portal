import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { lockedProductCopy } from '@/config/productAccess'

type LockedProductGateProps = {
  title?: string
  description?: string
}

export function LockedProductGate({
  title = lockedProductCopy.title,
  description = lockedProductCopy.description,
}: LockedProductGateProps) {
  const navigate = useNavigate()

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button onClick={() => navigate('/dashboard')}>{lockedProductCopy.backLabel}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
