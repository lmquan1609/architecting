FROM node:24-alpine3.22

#create app directory
WORKDIR /app

# install dependencies 
# A Wildcard to make sure that we will copy both package.json and package-lock.json
COPY app/package*.json /app/

RUN npm install

RUN rm -f app/index-base.js
RUN mv -f app/index-ecs.js app/index.js

# Bundle app source
COPY app/ . 

EXPOSE 3001
CMD ["npm", "start"]