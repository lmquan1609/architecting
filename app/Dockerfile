FROM node:24-alpine3.22

#create app directory
WORKDIR /app

# install dependencies 
# A Wildcard to make sure that we will copy both package.json and package-lock.json
COPY package*.json .

RUN npm install

RUN rm -f index-base.js
RUN mv -f index-ecs.js index.js

# Bundle app source
COPY . . 

EXPOSE 3001
CMD ["npm", "start"]