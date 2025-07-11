import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Star, ThumbsUp, MessageCircle } from 'lucide-react';
import { Badge } from '../ui/badge';

interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  ownershipPercentage: number;
  date: string;
}

interface ReviewsTabProps {
  reviews: Review[];
}

const ReviewsTab: React.FC<ReviewsTabProps> = ({ reviews }) => {
  const [showAddReview, setShowAddReview] = React.useState(false);
  
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    stars: rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: (reviews.filter(r => r.rating === rating).length / reviews.length) * 100
  }));

  return (
    <div className="space-y-6">
      {/* Reviews Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Co-Owner Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Rating */}
            <div className="text-center space-y-4">
              <div>
                <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
                <div className="flex items-center justify-center space-x-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-5 h-5 ${i < Math.floor(averageRating) ? 'text-warning fill-current' : 'text-muted-foreground'}`} 
                    />
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  Based on {reviews.length} co-owner reviews
                </div>
              </div>
              
              <Button 
                onClick={() => setShowAddReview(true)}
                className="w-full"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Add Your Review
              </Button>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {ratingDistribution.map((dist) => (
                <div key={dist.stars} className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 w-12">
                    <span className="text-sm">{dist.stars}</span>
                    <Star className="w-3 h-3 text-warning fill-current" />
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div 
                      className="bg-warning h-2 rounded-full"
                      style={{ width: `${dist.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">
                    {dist.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Avatar>
                  <AvatarFallback>
                    {review.userName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium">{review.userName}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {review.ownershipPercentage}% owner
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{review.date}</span>
                  </div>
                  
                  <div className="flex items-center space-x-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < review.rating ? 'text-warning fill-current' : 'text-muted-foreground'}`} 
                      />
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground mb-4">
                    {review.comment}
                  </p>
                  
                  <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm">
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Helpful (3)
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Review Modal/Form */}
      {showAddReview && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Add Your Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Rating</label>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-6 h-6 text-muted-foreground cursor-pointer hover:text-warning" 
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Your Review</label>
                <textarea 
                  className="w-full p-3 border border-border rounded-lg bg-background resize-none"
                  rows={4}
                  placeholder="Share your experience as a co-owner of this property..."
                />
              </div>
              
              <div className="flex space-x-3">
                <Button>Submit Review</Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowAddReview(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Guidelines */}
      <Card className="border-muted">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium mb-2">Review Guidelines</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Only verified token holders can leave reviews</p>
                <p>• Reviews should be based on your ownership experience</p>
                <p>• Be honest and constructive in your feedback</p>
                <p>• Focus on property management, returns, and communication</p>
                <p>• Inappropriate reviews will be moderated</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewsTab;