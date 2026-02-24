import { toString as mdastToString } from "mdast-util-to-string";
import getReadingTime from "reading-time";

export function remarkReadingTime() {
	// @ts-expect-error:next-line
	return (tree, { data }) => {
		const textOnPage = mdastToString(tree);
		const readingTime = getReadingTime(textOnPage);
		// "4 min read" şeklindeki metni "4 dk okuma" olarak Türkçeleştiriyoruz.
		data.astro.frontmatter.readingTime = readingTime.text.replace("min read", "dk okuma");
	};
}
