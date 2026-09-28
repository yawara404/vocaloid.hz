import { listLoungeMessages, parseLoungeCursor } from '../../utils/lounge'

export default defineEventHandler((event) => {
  const after = parseLoungeCursor(getQuery(event).after)
  return { items: listLoungeMessages(after) }
})
