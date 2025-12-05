import { Logger, LogLevel, Tweet, XAccountInsert, XAccountSelect} from "@gr2/core-models";
import { repositortFactory} from "@gr2/core-repositories";
import * as fs from "node:fs";
import * as path from "node:path";

export const XAccountRepository = repositortFactory.getXAccountRepository();
export const tweetRepository = repositortFactory.getTweetRepository();

const log = new Logger ({
    level: LogLevel.INFO, // Muc log co the la DEBUG, INFO, WARN, ERROR
})

//Lay tat ca ACC
export const getAllXAccounts = async () : Promise<XAccountSelect[]> => {
    try {
        return await XAccountRepository.findAll();
    } catch (error) {
        log.error("Error fetching X accounts:", error);
        throw error;
    }
};

// them hoac cap nhap Acc
export const saveAccount = async (account: XAccountInsert): Promise<void> => {
    try {
        if( account.id ) {
            await XAccountRepository.update(account.id, {
            ...account,
            updatedAt: new Date(),
        });
        log.info(`Account with ID ${account.id} updated successfully.`);
        } else {
            await XAccountRepository.create({
                ...account,
                createdAt: new Date(),
                updatedAt: new Date(),   
            });
            log.info(`New account created successfully.`);

        }
     } catch (error) {
        log.error("Error saving account:", error);
        throw error;
            
        
    }
};

// Luu tweet moi
export const saveTweets = async (accountId: string, tweets: Tweet[]) : Promise<Date | null> => {
    try {

    if(!tweets.length) return null;

    let newestTweetDate: Date | null = null;
    for ( const tweet of tweets ) {
        const tweetDate = new Date(tweet.time);
        await tweetRepository.create({
            authorId: accountId,
            url: tweet.url,
            retweetCount: tweet.retweetCount ?? 0,
            replyCount: tweet.replyCount ?? 0,
            likeCount: tweet.likeCount ?? 0,
            content: tweet.data,
            tweetTime : tweetDate,
        });

        //tim tweet moi nhat
        if (!newestTweetDate || tweetDate > newestTweetDate) {
    
            newestTweetDate = tweetDate;}
        }    
        
        //cap nhat lai lastScrapedAt tren XAccount
          if (newestTweetDate) {
      await XAccountRepository.updateLastTweetUpdatedAt(accountId, newestTweetDate);
      log.info(
        "x-scraper:db",
        `Updated lastTweetUpdatedAt for account ${accountId} to: ${newestTweetDate.toISOString()}`,
      );
    }

    return newestTweetDate;
    }catch (error) {
         log.error("x-scraper:db", `Error saving tweets for account ${accountId}:`, error);
    return null;
    }
};
