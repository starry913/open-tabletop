// The mirrored player's controls use exactly the same screen-space angle as A.
export function screenHeading(heading,mirrored=false){
  return ((mirrored?180-heading:heading)%360+360)%360;
}
