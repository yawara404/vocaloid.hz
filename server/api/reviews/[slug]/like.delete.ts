import { setReviewLike } from '../../../utils/likes'

export default defineEventHandler(event => setReviewLike(event, false))
