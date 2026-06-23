import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('driver-posts')
  async getDriverPosts() {
    return this.feedService.getDriverPosts();
  }
}

@Controller('post')
export class PostController {
  constructor(private readonly feedService: FeedService) {}

  @Get(':id')
  async getDriverPost(@Param('id') id: string) {
    const post = await this.feedService.getDriverPost(id);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }
}
